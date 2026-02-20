
-- Audio generation jobs table
CREATE TABLE public.audio_generation_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status text NOT NULL DEFAULT 'queued',
  total integer NOT NULL DEFAULT 100,
  done_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  logs jsonb DEFAULT '[]'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Audio generation items table
CREATE TABLE public.audio_generation_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.audio_generation_jobs(id) ON DELETE CASCADE,
  item_index integer NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  tries integer NOT NULL DEFAULT 0,
  last_error text,
  script jsonb,
  topic text,
  duration_sec integer,
  storage_url text,
  gravacao_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_generation_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audio_gen_items_job ON public.audio_generation_items(job_id, status);
