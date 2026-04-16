-- Normalize FONAR risk levels
UPDATE public.fonar_risk_assessments
SET risk_level = CASE lower(risk_level)
  WHEN 'extremo' THEN 'critico'
  WHEN 'grave' THEN 'alto'
  WHEN 'crítico' THEN 'critico'
  ELSE lower(risk_level)
END
WHERE risk_level IN ('extremo', 'grave', 'Extremo', 'Grave', 'Crítico', 'Critico', 'Alto', 'Moderado', 'Sem_risco', 'Sem Risco');

-- Normalize AMPARA risk levels
UPDATE public.risk_assessments
SET risk_level = CASE lower(risk_level)
  WHEN 'crítico' THEN 'critico'
  WHEN 'critico' THEN 'critico'
  WHEN 'alto' THEN 'alto'
  WHEN 'moderado' THEN 'moderado'
  WHEN 'médio' THEN 'moderado'
  WHEN 'medio' THEN 'moderado'
  WHEN 'baixo' THEN 'sem_risco'
  WHEN 'sem risco' THEN 'sem_risco'
  WHEN 'sem_risco' THEN 'sem_risco'
  ELSE lower(risk_level)
END
WHERE risk_level IS NOT NULL;

-- Normalize risk_context_snapshots (AMPARA + FONAR snapshots) for consistency
UPDATE public.risk_context_snapshots
SET risco_ampara = CASE lower(risco_ampara)
  WHEN 'crítico' THEN 'critico'
  WHEN 'baixo' THEN 'sem_risco'
  WHEN 'médio' THEN 'moderado'
  WHEN 'medio' THEN 'moderado'
  ELSE lower(risco_ampara)
END,
risco_fonar = CASE lower(risco_fonar)
  WHEN 'extremo' THEN 'critico'
  WHEN 'grave' THEN 'alto'
  WHEN 'crítico' THEN 'critico'
  WHEN 'baixo' THEN 'sem_risco'
  ELSE lower(risco_fonar)
END
WHERE risco_ampara IS NOT NULL OR risco_fonar IS NOT NULL;