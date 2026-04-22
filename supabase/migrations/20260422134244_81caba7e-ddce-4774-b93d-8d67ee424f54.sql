-- Create web_sso_tokens table for transparent SSO from mobile app to web portal
CREATE TABLE public.web_sso_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  mobile_session_id uuid,
  device_id text,
  issued_ip text,
  issued_user_agent text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_ip text,
  consumed_user_agent text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_web_sso_tokens_token_hash ON public.web_sso_tokens(token_hash);
CREATE INDEX idx_web_sso_tokens_user_id ON public.web_sso_tokens(user_id);
CREATE INDEX idx_web_sso_tokens_expires_at ON public.web_sso_tokens(expires_at);

ALTER TABLE public.web_sso_tokens ENABLE ROW LEVEL SECURITY;

-- Block all direct access. Tokens are managed exclusively by edge functions via service_role.
CREATE POLICY "Block direct access web_sso_tokens"
ON public.web_sso_tokens
FOR ALL
TO public
USING (false)
WITH CHECK (false);