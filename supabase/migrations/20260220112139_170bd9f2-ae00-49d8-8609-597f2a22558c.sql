
-- Enable RLS on audit_logs (if not already)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon select for admin audit viewing
CREATE POLICY "Allow anon select audit_logs"
ON public.audit_logs
FOR SELECT
USING (true);
