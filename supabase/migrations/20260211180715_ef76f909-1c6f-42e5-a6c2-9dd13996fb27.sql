
-- Remove overly permissive policies - service_role bypasses RLS anyway
DROP POLICY "Service role full access on usuarios" ON public.usuarios;
DROP POLICY "Service role full access on audit_logs" ON public.audit_logs;
DROP POLICY "Service role full access on rate_limit_attempts" ON public.rate_limit_attempts;
DROP POLICY "Service role full access on user_sessions" ON public.user_sessions;
