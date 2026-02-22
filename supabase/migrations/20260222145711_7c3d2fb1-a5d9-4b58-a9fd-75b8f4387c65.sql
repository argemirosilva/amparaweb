CREATE OR REPLACE FUNCTION public.count_unanalyzed_gravacoes()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM gravacoes g
  WHERE g.transcricao IS NOT NULL
    AND g.transcricao != ''
    AND NOT EXISTS (
      SELECT 1 FROM gravacoes_analises ga WHERE ga.gravacao_id = g.id
    );
$$;