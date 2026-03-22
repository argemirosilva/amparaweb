
CREATE TABLE public.whatsapp_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_label text NOT NULL,
  total_messages integer NOT NULL DEFAULT 0,
  total_chunks integer NOT NULL DEFAULT 0,
  analyzed_chunks integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing',
  summary_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  error_message text
);

ALTER TABLE public.whatsapp_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access whatsapp_imports"
  ON public.whatsapp_imports FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.analysis_micro_results
  ADD COLUMN import_id uuid REFERENCES public.whatsapp_imports(id) ON DELETE CASCADE;
