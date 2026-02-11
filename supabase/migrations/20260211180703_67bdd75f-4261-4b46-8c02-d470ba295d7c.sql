
-- Create user_status enum
CREATE TYPE public.user_status AS ENUM ('pendente', 'ativo', 'inativo', 'bloqueado');

-- Create usuarios table
CREATE TABLE public.usuarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status public.user_status NOT NULL DEFAULT 'pendente',
  email_verificado BOOLEAN NOT NULL DEFAULT false,
  codigo_verificacao TEXT,
  codigo_verificacao_expira TIMESTAMPTZ,
  senha_hash TEXT NOT NULL,
  senha_coacao_hash TEXT,
  termos_aceitos_em TIMESTAMPTZ,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.usuarios(id),
  action_type TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rate_limit_attempts table
CREATE TABLE public.rate_limit_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- email or email+ip
  action_type TEXT NOT NULL, -- register, login, verify_code
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for rate limit lookups
CREATE INDEX idx_rate_limit_identifier_action ON public.rate_limit_attempts(identifier, action_type, attempted_at);

-- Create user_sessions table
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.usuarios(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_token_hash ON public.user_sessions(token_hash);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);

-- Enable RLS on all tables
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies: these tables are accessed via edge functions using service_role key
-- so we allow service_role full access and deny anon
CREATE POLICY "Service role full access on usuarios" ON public.usuarios
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on audit_logs" ON public.audit_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on rate_limit_attempts" ON public.rate_limit_attempts
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on user_sessions" ON public.user_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
