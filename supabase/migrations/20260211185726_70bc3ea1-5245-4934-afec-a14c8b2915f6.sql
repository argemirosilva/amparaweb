
-- alertas_panico (minimal for logoutMobile check)
CREATE TABLE IF NOT EXISTS public.alertas_panico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  device_id text NULL,
  status text NOT NULL DEFAULT 'ativo',
  protocolo text NULL,
  tipo_acionamento text NULL,
  latitude double precision NULL,
  longitude double precision NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  cancelado_em timestamptz NULL,
  motivo_cancelamento text NULL,
  tipo_cancelamento text NULL
);

ALTER TABLE public.alertas_panico ENABLE ROW LEVEL SECURITY;
