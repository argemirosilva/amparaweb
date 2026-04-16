-- ============================================================
-- RISK INTELLIGENCE LAYER (RIL) — módulo isolado
-- ============================================================

-- 1) Settings (feature flag)
CREATE TABLE IF NOT EXISTS public.ril_settings (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ril_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ril_settings_public_read" ON public.ril_settings
  FOR SELECT USING (true);

CREATE POLICY "ril_settings_block_write" ON public.ril_settings
  FOR ALL USING (false) WITH CHECK (false);

INSERT INTO public.ril_settings (chave, valor)
VALUES ('enabled', 'true'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- 2) Helper: feature flag
CREATE OR REPLACE FUNCTION public.ril_is_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT (valor)::text::boolean INTO v_enabled
  FROM public.ril_settings WHERE chave = 'enabled' LIMIT 1;
  RETURN COALESCE(v_enabled, false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- 3) Snapshots de contexto (núcleo do RIL)
CREATE TABLE IF NOT EXISTS public.risk_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Risco original (NUNCA misturado)
  risco_ampara TEXT NOT NULL DEFAULT 'sem_risco',     -- sem_risco | moderado | alto | critico
  risco_ampara_score INTEGER NOT NULL DEFAULT 0,
  risco_fonar TEXT NOT NULL DEFAULT 'sem_risco',      -- sem_risco | moderado | grave | extremo
  risco_fonar_score INTEGER NOT NULL DEFAULT 0,
  -- Camada interpretativa
  divergencia_entre_modelos BOOLEAN NOT NULL DEFAULT false,
  divergencia_magnitude INTEGER NOT NULL DEFAULT 0,   -- 0..3
  tendencia_risco TEXT NOT NULL DEFAULT 'estavel',    -- subindo | estavel | descendo
  confiabilidade_contexto TEXT NOT NULL DEFAULT 'media', -- baixa | media | alta
  fatores_criticos_ativos JSONB NOT NULL DEFAULT '[]'::jsonb,
  fatores_reincidentes JSONB NOT NULL DEFAULT '[]'::jsonb,
  nivel_prioridade_intervencao TEXT NOT NULL DEFAULT 'baixo', -- baixo|medio|alto|urgente
  recomendacao_acao TEXT,
  origem_evento TEXT NOT NULL DEFAULT 'cron',         -- cron | trigger | manual
  uf TEXT,
  cidade TEXT,
  latest BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_ril_snap_user ON public.risk_context_snapshots(user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ril_snap_latest ON public.risk_context_snapshots(user_id) WHERE latest = true;
CREATE INDEX IF NOT EXISTS idx_ril_snap_priority ON public.risk_context_snapshots(nivel_prioridade_intervencao, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ril_snap_uf ON public.risk_context_snapshots(uf, computed_at DESC);

ALTER TABLE public.risk_context_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ril_snap_public_read" ON public.risk_context_snapshots
  FOR SELECT USING (true);

CREATE POLICY "ril_snap_block_write" ON public.risk_context_snapshots
  FOR ALL USING (false) WITH CHECK (false);

-- 4) Eventos próprios do RIL
CREATE TABLE IF NOT EXISTS public.ril_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_type TEXT NOT NULL, -- risk_context_created | risk_divergence_detected | risk_escalation_detected | risk_recurrence_detected | institutional_alert_generated
  snapshot_id UUID REFERENCES public.risk_context_snapshots(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'info', -- info | warning | critical
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ril_events_type ON public.ril_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ril_events_user ON public.ril_events(user_id, created_at DESC);

ALTER TABLE public.ril_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ril_events_public_read" ON public.ril_events
  FOR SELECT USING (true);

CREATE POLICY "ril_events_block_write" ON public.ril_events
  FOR ALL USING (false) WITH CHECK (false);

-- 5) Métricas agregadas (Government Insights)
CREATE TABLE IF NOT EXISTS public.ril_government_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'nacional', -- nacional | uf | cidade
  scope_value TEXT,                            -- ex: "SP", "São Paulo/SP"
  -- Indicadores (k-anonimizados; nunca individuais)
  total_amostras INTEGER NOT NULL DEFAULT 0,
  k_anonymity_min INTEGER NOT NULL DEFAULT 5,  -- não publica abaixo disto
  distribuicao_risco JSONB NOT NULL DEFAULT '{}'::jsonb,        -- {moderado, grave, extremo}
  tendencia_temporal JSONB NOT NULL DEFAULT '{}'::jsonb,        -- série temporal
  taxa_escalada NUMERIC,
  tempo_medio_agravamento_dias NUMERIC,
  taxa_recorrencia NUMERIC,
  fatores_mais_comuns JSONB NOT NULL DEFAULT '[]'::jsonb,
  efetividade_intervencao NUMERIC,
  taxa_atualizacao_fonar NUMERIC,
  correlacao_ampara_fonar JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {convergencia, divergencia}
  indicador_subnotificacao NUMERIC,
  payload_extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ril_metrics_period ON public.ril_government_metrics(period_end DESC);
CREATE INDEX IF NOT EXISTS idx_ril_metrics_scope ON public.ril_government_metrics(scope_type, scope_value, period_end DESC);

ALTER TABLE public.ril_government_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ril_metrics_public_read" ON public.ril_government_metrics
  FOR SELECT USING (true);

CREATE POLICY "ril_metrics_block_write" ON public.ril_government_metrics
  FOR ALL USING (false) WITH CHECK (false);

-- 6) Trigger leve em fonar_risk_assessments (sinal de revisão crítica)
CREATE OR REPLACE FUNCTION public.ril_on_fonar_risk_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NOT public.ril_is_enabled() THEN
      RETURN NEW;
    END IF;

    -- Só registra evento; cálculo do snapshot é assíncrono via worker
    INSERT INTO public.ril_events (user_id, event_type, severity, payload)
    VALUES (
      NEW.user_id,
      'risk_recompute_requested',
      CASE WHEN NEW.risk_level IN ('grave','extremo','critico','alto') THEN 'critical' ELSE 'info' END,
      jsonb_build_object(
        'source', 'fonar_risk_assessments',
        'risco_fonar', NEW.risk_level,
        'score', NEW.risk_score
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- silencia: core nunca é afetado
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ril_on_fonar_risk_changed ON public.fonar_risk_assessments;
CREATE TRIGGER trg_ril_on_fonar_risk_changed
AFTER INSERT ON public.fonar_risk_assessments
FOR EACH ROW EXECUTE FUNCTION public.ril_on_fonar_risk_changed();

-- 7) Trigger em alertas_panico (escalada imediata)
CREATE OR REPLACE FUNCTION public.ril_on_panic_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NOT public.ril_is_enabled() THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.ril_events (user_id, event_type, severity, payload)
    VALUES (
      NEW.user_id,
      'risk_escalation_detected',
      'critical',
      jsonb_build_object(
        'source', 'alertas_panico',
        'tipo_acionamento', NEW.tipo_acionamento,
        'criado_em', NEW.criado_em
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ril_on_panic_inserted ON public.alertas_panico;
CREATE TRIGGER trg_ril_on_panic_inserted
AFTER INSERT ON public.alertas_panico
FOR EACH ROW EXECUTE FUNCTION public.ril_on_panic_inserted();