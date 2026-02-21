
-- 1. gravacoes: allow anonymous SELECT
CREATE POLICY "Allow anon select gravacoes"
  ON public.gravacoes
  FOR SELECT
  TO anon
  USING (true);

-- 2. gravacoes_analises: drop the blocking ALL policy
DROP POLICY IF EXISTS "Block direct access gravacoes_analises" ON public.gravacoes_analises;

-- 3. gravacoes_analises: allow anonymous SELECT
CREATE POLICY "Allow anon select gravacoes_analises"
  ON public.gravacoes_analises
  FOR SELECT
  TO anon
  USING (true);

-- 4. gravacoes_analises: block direct writes (INSERT/UPDATE/DELETE)
CREATE POLICY "Block direct write gravacoes_analises"
  ON public.gravacoes_analises
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
