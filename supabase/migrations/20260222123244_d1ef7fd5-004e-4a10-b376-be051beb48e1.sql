
CREATE OR REPLACE FUNCTION public.get_unanalyzed_gravacoes(p_limit integer DEFAULT 5)
RETURNS TABLE(id uuid, user_id uuid, transcricao text) 
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id, g.user_id, g.transcricao
  FROM gravacoes g
  WHERE g.transcricao IS NOT NULL
    AND g.transcricao != ''
    AND NOT EXISTS (
      SELECT 1 FROM gravacoes_analises ga WHERE ga.gravacao_id = g.id
    )
  ORDER BY g.created_at
  LIMIT p_limit;
$$;
