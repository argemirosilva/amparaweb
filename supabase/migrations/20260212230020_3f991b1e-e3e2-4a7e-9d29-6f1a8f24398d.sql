-- Allow users to read their own monitoring schedules via service-role or anon
CREATE POLICY "Allow anon select agendamentos_monitoramento"
ON public.agendamentos_monitoramento
FOR SELECT
USING (true);

-- Allow users to read their own monitoring sessions via anon
CREATE POLICY "Allow anon select monitoramento_sessoes"
ON public.monitoramento_sessoes
FOR SELECT
USING (true);