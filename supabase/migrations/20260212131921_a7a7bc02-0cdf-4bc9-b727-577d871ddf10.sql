
-- Create risk_assessments table
CREATE TABLE public.risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id),
  window_days int NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  risk_score int NOT NULL,
  risk_level text NOT NULL,
  trend text NOT NULL,
  trend_percentage numeric,
  fatores jsonb,
  resumo_tecnico text,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- Index for cache lookups
CREATE INDEX idx_risk_assessments_lookup ON public.risk_assessments (usuario_id, window_days, period_end DESC);

-- Enable RLS with restrictive policy (access only via service_role)
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access risk_assessments"
  ON public.risk_assessments
  AS RESTRICTIVE
  FOR ALL
  USING (false);
