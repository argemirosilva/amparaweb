
-- Etapa 1: Adicionar colunas para controle de janelas de monitoramento

-- monitoramento_sessoes: colunas de janela
ALTER TABLE public.monitoramento_sessoes
  ADD COLUMN IF NOT EXISTS window_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS window_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS sealed_reason text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_segments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_duration_seconds double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_gravacao_id uuid,
  ADD COLUMN IF NOT EXISTS origem text;

-- gravacoes_segmentos: received_at
ALTER TABLE public.gravacoes_segmentos
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();

-- gravacoes: monitor_session_id
ALTER TABLE public.gravacoes
  ADD COLUMN IF NOT EXISTS monitor_session_id uuid;

-- Índice único para idempotência de segmentos
CREATE UNIQUE INDEX IF NOT EXISTS idx_gravacoes_segmentos_session_idx
  ON public.gravacoes_segmentos (monitor_session_id, segmento_idx)
  WHERE monitor_session_id IS NOT NULL AND segmento_idx IS NOT NULL;

-- FK de gravacoes.monitor_session_id -> monitoramento_sessoes.id
ALTER TABLE public.gravacoes
  ADD CONSTRAINT gravacoes_monitor_session_id_fkey
  FOREIGN KEY (monitor_session_id) REFERENCES public.monitoramento_sessoes(id);
