
-- ============================================================
-- MÓDULO SUPORTE TÉCNICO SEGURO — FASE 1
-- ============================================================

-- ENUMS
CREATE TYPE public.support_session_status AS ENUM ('open','waiting_user','waiting_consent','active','closed');
CREATE TYPE public.support_category AS ENUM ('app_issue','playback','upload','gps','notifications','account','recording_question','transcription_question','analysis_question','other');
CREATE TYPE public.support_sender_type AS ENUM ('user','agent','system');
CREATE TYPE public.support_resource_type AS ENUM ('recording','transcription','analysis','metadata','logs');
CREATE TYPE public.support_access_scope AS ENUM ('read_metadata','read_transcription','read_audio_stream','read_analysis','read_logs');
CREATE TYPE public.support_access_status AS ENUM ('pending','granted','denied','expired','blocked');
CREATE TYPE public.support_revoked_by AS ENUM ('system','user','agent');
CREATE TYPE public.support_audit_event AS ENUM ('session_created','agent_assigned','access_requested','code_shown','access_granted','data_accessed','access_revoked','access_expired','session_closed','password_reset_initiated');

-- 1) support_sessions
CREATE TABLE public.support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id),
  agent_id uuid REFERENCES public.usuarios(id),
  status public.support_session_status NOT NULL DEFAULT 'open',
  category public.support_category NOT NULL DEFAULT 'other',
  sensitivity_level text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_sessions" ON public.support_sessions FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_support_sessions_user ON public.support_sessions (user_id, created_at DESC);
CREATE INDEX idx_support_sessions_agent ON public.support_sessions (agent_id, created_at DESC);
CREATE INDEX idx_support_sessions_status ON public.support_sessions (status);

-- 2) support_messages
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
  sender_type public.support_sender_type NOT NULL,
  sender_id uuid,
  message_text text NOT NULL,
  redacted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_messages" ON public.support_messages FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_support_messages_session ON public.support_messages (session_id, created_at);

-- 3) support_access_requests
CREATE TABLE public.support_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.usuarios(id),
  user_id uuid NOT NULL REFERENCES public.usuarios(id),
  resource_type public.support_resource_type NOT NULL,
  resource_id uuid NOT NULL,
  requested_scope public.support_access_scope NOT NULL,
  justification_text text NOT NULL,
  code_hash text NOT NULL,
  code_expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  status public.support_access_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_access_requests" ON public.support_access_requests FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_support_access_requests_session ON public.support_access_requests (session_id, created_at DESC);
CREATE INDEX idx_support_access_requests_user ON public.support_access_requests (user_id, status);

-- 4) support_access_grants
CREATE TABLE public.support_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.support_access_requests(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  revoked_at timestamptz,
  revoked_by public.support_revoked_by,
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.support_access_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_access_grants" ON public.support_access_grants FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_support_access_grants_request ON public.support_access_grants (request_id);
CREATE INDEX idx_support_access_grants_active ON public.support_access_grants (active, expires_at) WHERE active = true;

-- 5) support_data_access_log
CREATE TABLE public.support_data_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.support_sessions(id),
  agent_id uuid NOT NULL REFERENCES public.usuarios(id),
  user_id uuid NOT NULL REFERENCES public.usuarios(id),
  resource_type public.support_resource_type NOT NULL,
  resource_id uuid NOT NULL,
  action text NOT NULL,
  grant_id uuid NOT NULL REFERENCES public.support_access_grants(id),
  agent_ip text,
  agent_device text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_data_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_data_access_log" ON public.support_data_access_log FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_support_data_access_log_session ON public.support_data_access_log (session_id, created_at DESC);
CREATE INDEX idx_support_data_access_log_agent ON public.support_data_access_log (agent_id, created_at DESC);

-- 6) support_audit_timeline
CREATE TABLE public.support_audit_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id),
  session_id uuid NOT NULL REFERENCES public.support_sessions(id),
  event_type public.support_audit_event NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_audit_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_audit_timeline" ON public.support_audit_timeline FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_support_audit_timeline_user ON public.support_audit_timeline (user_id, created_at DESC);
CREATE INDEX idx_support_audit_timeline_session ON public.support_audit_timeline (session_id, created_at DESC);

-- 7) support_agent_reauth_log
CREATE TABLE public.support_agent_reauth_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.usuarios(id),
  reauth_at timestamptz NOT NULL DEFAULT now(),
  mfa_used boolean NOT NULL DEFAULT false,
  success boolean NOT NULL DEFAULT true,
  method text NOT NULL DEFAULT 'password'
);
ALTER TABLE public.support_agent_reauth_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_agent_reauth_log" ON public.support_agent_reauth_log FOR ALL USING (false) WITH CHECK (false);
CREATE INDEX idx_support_agent_reauth_log_agent ON public.support_agent_reauth_log (agent_id, reauth_at DESC);
