
-- Add permissive SELECT policies for Realtime to work
-- device_status
CREATE POLICY "Allow anon select device_status permissive"
  ON public.device_status FOR SELECT
  USING (true);

-- alertas_panico  
CREATE POLICY "Allow anon select alertas_panico permissive"
  ON public.alertas_panico FOR SELECT
  USING (true);

-- localizacoes
CREATE POLICY "Allow anon select localizacoes permissive"
  ON public.localizacoes FOR SELECT
  USING (true);
