
-- gravacoes table
CREATE TABLE IF NOT EXISTS public.gravacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  device_id text NULL,
  file_url text NULL,
  storage_path text NULL,
  duracao_segundos double precision NULL,
  tamanho_mb double precision NULL,
  status text NOT NULL DEFAULT 'pendente',
  transcricao text NULL,
  processado_em timestamptz NULL,
  erro_processamento text NULL,
  timezone text NULL,
  timezone_offset_minutes int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gravacoes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_gravacoes_updated_at
  BEFORE UPDATE ON public.gravacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- gravacoes_segmentos table
CREATE TABLE IF NOT EXISTS public.gravacoes_segmentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  monitor_session_id uuid NULL REFERENCES public.monitoramento_sessoes(id),
  device_id text NULL,
  file_url text NULL,
  storage_path text NULL,
  segmento_idx int NULL,
  duracao_segundos double precision NULL,
  tamanho_mb double precision NULL,
  timezone text NULL,
  timezone_offset_minutes int NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gravacoes_segmentos ENABLE ROW LEVEL SECURITY;

-- Storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio-recordings bucket
CREATE POLICY "Service role full access to audio-recordings"
ON storage.objects FOR ALL
USING (bucket_id = 'audio-recordings')
WITH CHECK (bucket_id = 'audio-recordings');
