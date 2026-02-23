ALTER TABLE gravacoes_analises ADD COLUMN IF NOT EXISTS cupiado boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_gravacoes_analises_cupiado ON gravacoes_analises(cupiado);