
-- 1. Remove duplicatas, mantendo apenas a análise mais recente por gravação
DELETE FROM gravacoes_analises
WHERE id NOT IN (
  SELECT DISTINCT ON (gravacao_id) id
  FROM gravacoes_analises
  ORDER BY gravacao_id, created_at DESC
);

-- 2. Adiciona constraint UNIQUE para impedir duplicatas futuras
ALTER TABLE gravacoes_analises
ADD CONSTRAINT gravacoes_analises_gravacao_id_unique UNIQUE (gravacao_id);
