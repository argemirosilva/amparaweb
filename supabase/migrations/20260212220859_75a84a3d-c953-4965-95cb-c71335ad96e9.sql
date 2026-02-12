
-- Table for temporary GPS sharing links
CREATE TABLE public.compartilhamento_gps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id),
  codigo text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'panico', -- 'panico' or 'risco_alto'
  alerta_id uuid REFERENCES public.alertas_panico(id),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  expira_em timestamp with time zone NOT NULL
);

-- Enable RLS
ALTER TABLE public.compartilhamento_gps ENABLE ROW LEVEL SECURITY;

-- Public read for anyone with the code (anonymous access)
CREATE POLICY "Allow public select by code"
ON public.compartilhamento_gps
FOR SELECT
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.compartilhamento_gps;
