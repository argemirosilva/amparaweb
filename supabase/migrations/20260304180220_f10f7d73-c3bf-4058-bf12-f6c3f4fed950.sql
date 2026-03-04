ALTER TABLE gravacoes_segmentos
  ADD COLUMN IF NOT EXISTS triage_risco text,
  ADD COLUMN IF NOT EXISTS triage_transcricao text,
  ADD COLUMN IF NOT EXISTS triage_at timestamptz;