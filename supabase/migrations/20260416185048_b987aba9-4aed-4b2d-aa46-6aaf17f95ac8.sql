-- ============================================================
-- MÓDULO FONAR DINÂMICO — CAMADA OBSERVADORA ISOLADA
-- ============================================================

-- 1. SETTINGS (feature flag global)
CREATE TABLE public.fonar_settings (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fonar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fonar_settings_public_read" ON public.fonar_settings
  FOR SELECT USING (true);

CREATE POLICY "fonar_settings_block_write" ON public.fonar_settings
  FOR ALL USING (false) WITH CHECK (false);

INSERT INTO public.fonar_settings (chave, valor) VALUES
  ('enabled', 'true'::jsonb),
  ('worker_batch_size', '50'::jsonb),
  ('relevance_thresholds', '{"alta":["alto","critico"],"critica":["critico"]}'::jsonb);

-- 2. SUBMISSIONS (questionário atual da usuária)
CREATE TABLE public.fonar_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | concluido
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 8,
  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.fonar_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fonar_submissions_public_read" ON public.fonar_submissions FOR SELECT USING (true);
CREATE POLICY "fonar_submissions_block_write" ON public.fonar_submissions FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_fonar_submissions_user ON public.fonar_submissions(user_id);

-- 3. VERSIONS (histórico imutável)
CREATE TABLE public.fonar_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.fonar_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  versao INTEGER NOT NULL,
  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
  origem TEXT NOT NULL DEFAULT 'manual', -- manual | sugestao_revisao | onboarding
  suggestion_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fonar_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fonar_versions_public_read" ON public.fonar_versions FOR SELECT USING (true);
CREATE POLICY "fonar_versions_block_write" ON public.fonar_versions FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_fonar_versions_user ON public.fonar_versions(user_id, created_at DESC);

-- 4. SIGNALS (fila de eventos consumidos do core)
CREATE TABLE public.fonar_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_namespace TEXT NOT NULL, -- fonar_micro | fonar_macro | fonar_panico
  event_source_table TEXT NOT NULL,
  event_source_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | processed | skipped | error
  relevance TEXT, -- baixa | media | alta | critica
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fonar_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fonar_signals_public_read" ON public.fonar_signals FOR SELECT USING (true);
CREATE POLICY "fonar_signals_block_write" ON public.fonar_signals FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_fonar_signals_status ON public.fonar_signals(status, created_at);
CREATE INDEX idx_fonar_signals_user ON public.fonar_signals(user_id, created_at DESC);

-- 5. REVIEW SUGGESTIONS
CREATE TABLE public.fonar_review_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  signal_id UUID REFERENCES public.fonar_signals(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  motivo TEXT NOT NULL,
  campos_sugeridos TEXT[] DEFAULT '{}'::text[],
  relevance TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | revisada | ignorada | expirada
  acted_at TIMESTAMPTZ,
  acted_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fonar_review_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fonar_suggestions_public_read" ON public.fonar_review_suggestions FOR SELECT USING (true);
CREATE POLICY "fonar_suggestions_block_write" ON public.fonar_review_suggestions FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_fonar_suggestions_user_status ON public.fonar_review_suggestions(user_id, status, created_at DESC);

-- 6. RISK ASSESSMENTS (paralelo, NUNCA mistura com risco_ampara)
CREATE TABLE public.fonar_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  version_id UUID REFERENCES public.fonar_versions(id) ON DELETE SET NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'sem_risco', -- sem_risco | moderado | alto | critico
  fatores JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latest BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.fonar_risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fonar_risk_public_read" ON public.fonar_risk_assessments FOR SELECT USING (true);
CREATE POLICY "fonar_risk_block_write" ON public.fonar_risk_assessments FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_fonar_risk_user_latest ON public.fonar_risk_assessments(user_id, latest, computed_at DESC);

-- 7. LOGS (auditoria interna)
CREATE TABLE public.fonar_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  level TEXT NOT NULL DEFAULT 'info', -- info | warn | error
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fonar_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fonar_logs_block" ON public.fonar_logs FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX idx_fonar_logs_created ON public.fonar_logs(created_at DESC);

-- ============================================================
-- TRIGGER FUNCTIONS (todas com EXCEPTION para nunca quebrar o core)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fonar_is_enabled()
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
  FROM public.fonar_settings WHERE chave = 'enabled' LIMIT 1;
  RETURN COALESCE(v_enabled, false);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Trigger para analysis_micro_results
CREATE OR REPLACE FUNCTION public.fonar_on_micro_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NOT public.fonar_is_enabled() THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.fonar_signals (
      user_id, event_namespace, event_source_table, event_source_id, payload
    ) VALUES (
      NEW.user_id,
      'fonar_micro',
      'analysis_micro_results',
      NEW.id,
      jsonb_build_object(
        'risk_level', NEW.risk_level,
        'cycle_phase', NEW.cycle_phase,
        'context_classification', NEW.context_classification,
        'created_at', NEW.created_at
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Silencia qualquer erro: o core NUNCA pode ser afetado
    NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fonar_on_micro_inserted
AFTER INSERT ON public.analysis_micro_results
FOR EACH ROW EXECUTE FUNCTION public.fonar_on_micro_inserted();

-- Trigger para analysis_macro_reports
CREATE OR REPLACE FUNCTION public.fonar_on_macro_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NOT public.fonar_is_enabled() THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.fonar_signals (
      user_id, event_namespace, event_source_table, event_source_id, payload
    ) VALUES (
      NEW.user_id,
      'fonar_macro',
      'analysis_macro_reports',
      NEW.id,
      jsonb_build_object(
        'window_days', NEW.window_days,
        'window_start', NEW.window_start,
        'window_end', NEW.window_end,
        'output_summary', COALESCE(NEW.output_json->'resumo', '{}'::jsonb)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fonar_on_macro_inserted
AFTER INSERT ON public.analysis_macro_reports
FOR EACH ROW EXECUTE FUNCTION public.fonar_on_macro_inserted();

-- Trigger para alertas_panico
CREATE OR REPLACE FUNCTION public.fonar_on_panic_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF NOT public.fonar_is_enabled() THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.fonar_signals (
      user_id, event_namespace, event_source_table, event_source_id, payload
    ) VALUES (
      NEW.user_id,
      'fonar_panico',
      'alertas_panico',
      NEW.id,
      jsonb_build_object(
        'tipo_acionamento', NEW.tipo_acionamento,
        'status', NEW.status,
        'criado_em', NEW.criado_em
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fonar_on_panic_inserted
AFTER INSERT ON public.alertas_panico
FOR EACH ROW EXECUTE FUNCTION public.fonar_on_panic_inserted();

-- Trigger updated_at em submissions
CREATE TRIGGER trg_fonar_submissions_updated_at
BEFORE UPDATE ON public.fonar_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();