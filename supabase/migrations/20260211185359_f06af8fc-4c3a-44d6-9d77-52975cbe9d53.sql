
-- 1. refresh_tokens
CREATE TABLE public.refresh_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  replaced_by uuid NULL REFERENCES public.refresh_tokens(id),
  ip_address text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- 2. device_status
CREATE TABLE public.device_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  last_ping_at timestamptz,
  status text NOT NULL DEFAULT 'offline',
  bateria_percentual int NULL,
  is_charging boolean NULL,
  dispositivo_info text NULL,
  versao_app text NULL,
  is_recording boolean NOT NULL DEFAULT false,
  is_monitoring boolean NOT NULL DEFAULT false,
  timezone text NULL,
  timezone_offset_minutes int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_id)
);

ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_device_status_updated_at
  BEFORE UPDATE ON public.device_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. monitoramento_sessoes
CREATE TABLE public.monitoramento_sessoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  device_id text NULL,
  status text NOT NULL DEFAULT 'ativa',
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monitoramento_sessoes ENABLE ROW LEVEL SECURITY;

-- 4. agendamentos_monitoramento
CREATE TABLE public.agendamentos_monitoramento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE UNIQUE,
  periodos_semana jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agendamentos_monitoramento ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos_monitoramento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Coluna tipo_interesse em usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS tipo_interesse text NULL;
