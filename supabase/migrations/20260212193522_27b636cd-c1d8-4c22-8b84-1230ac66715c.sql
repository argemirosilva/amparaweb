-- Allow anon read on localizacoes (app uses custom auth, not Supabase Auth)
CREATE POLICY "Allow anon select localizacoes"
ON public.localizacoes FOR SELECT
USING (true);

-- Allow anon read on usuarios (app uses custom auth, not Supabase Auth)
CREATE POLICY "Allow anon select usuarios"
ON public.usuarios FOR SELECT
USING (true);

-- Allow anon read on alertas_panico
CREATE POLICY "Allow anon select alertas_panico"
ON public.alertas_panico FOR SELECT
USING (true);

-- Allow anon read on device_status
CREATE POLICY "Allow anon select device_status"
ON public.device_status FOR SELECT
USING (true);