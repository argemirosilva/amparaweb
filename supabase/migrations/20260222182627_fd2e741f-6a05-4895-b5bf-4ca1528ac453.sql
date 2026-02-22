
-- ============================================================
-- 1) analysis_micro_results
-- ============================================================
CREATE TABLE public.analysis_micro_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recording_id uuid,
  transcription_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  prompt_version text NOT NULL,
  model text NOT NULL,
  input_hash text NOT NULL,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'sem_risco',
  context_classification text NOT NULL DEFAULT 'saudavel',
  cycle_phase text NOT NULL DEFAULT 'nao_identificado',
  latest boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'success',
  error_message text
);

CREATE UNIQUE INDEX uq_micro_transcription_latest
  ON public.analysis_micro_results (transcription_id)
  WHERE latest = true AND transcription_id IS NOT NULL;

CREATE UNIQUE INDEX uq_micro_recording_latest
  ON public.analysis_micro_results (recording_id)
  WHERE latest = true AND recording_id IS NOT NULL;

CREATE INDEX idx_micro_user_created ON public.analysis_micro_results (user_id, created_at DESC);
CREATE INDEX idx_micro_risk_created ON public.analysis_micro_results (risk_level, created_at DESC);
CREATE INDEX idx_micro_cycle_created ON public.analysis_micro_results (cycle_phase, created_at DESC);
CREATE INDEX idx_micro_transcription_latest ON public.analysis_micro_results (transcription_id, latest);
CREATE INDEX idx_micro_recording_latest ON public.analysis_micro_results (recording_id, latest);

ALTER TABLE public.analysis_micro_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_micro" ON public.analysis_micro_results
  FOR SELECT USING (true);

-- ============================================================
-- 2) analysis_macro_reports
-- ============================================================
CREATE TABLE public.analysis_macro_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  window_days int NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  prompt_version text NOT NULL,
  model text NOT NULL,
  aggregates_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  latest boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'success',
  error_message text
);

CREATE UNIQUE INDEX uq_macro_user_window_latest
  ON public.analysis_macro_reports (user_id, window_days)
  WHERE latest = true;

CREATE INDEX idx_macro_user_created ON public.analysis_macro_reports (user_id, created_at DESC);
CREATE INDEX idx_macro_user_window_latest ON public.analysis_macro_reports (user_id, window_days, latest);

ALTER TABLE public.analysis_macro_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_macro" ON public.analysis_macro_reports
  FOR SELECT USING (true);

-- ============================================================
-- 3) analysis_jobs
-- ============================================================
CREATE TABLE public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_error text
);

CREATE INDEX idx_jobs_status_scheduled ON public.analysis_jobs (status, scheduled_for);
CREATE INDEX idx_jobs_user ON public.analysis_jobs (user_id, created_at DESC);

ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_jobs" ON public.analysis_jobs
  FOR SELECT USING (true);
