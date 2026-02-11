
-- localizacoes table for GPS tracking
CREATE TABLE IF NOT EXISTS public.localizacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  device_id text NULL,
  alerta_id uuid NULL REFERENCES public.alertas_panico(id),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  precisao_metros double precision NULL,
  bateria_percentual int NULL,
  speed double precision NULL,
  heading double precision NULL,
  timestamp_gps timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.localizacoes ENABLE ROW LEVEL SECURITY;

-- Add columns to alertas_panico that may be needed
ALTER TABLE public.alertas_panico
  ADD COLUMN IF NOT EXISTS window_id uuid NULL,
  ADD COLUMN IF NOT EXISTS window_selada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoridades_acionadas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardioes_notificados boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tempo_ate_cancelamento_segundos int NULL,
  ADD COLUMN IF NOT EXISTS cancelado_dentro_janela boolean NULL;
