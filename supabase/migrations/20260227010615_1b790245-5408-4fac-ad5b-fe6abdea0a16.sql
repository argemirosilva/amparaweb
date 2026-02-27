-- Add CPF column to agressores (stored as digits only, masked on display)
ALTER TABLE agressores ADD COLUMN IF NOT EXISTS cpf_hash text;
ALTER TABLE agressores ADD COLUMN IF NOT EXISTS cpf_last4 text;

-- Update search function to include CPF parameter
CREATE OR REPLACE FUNCTION public.search_agressor_candidates(
  p_name text DEFAULT NULL, p_alias text DEFAULT NULL,
  p_father_first text DEFAULT NULL, p_mother_first text DEFAULT NULL,
  p_ddd text DEFAULT NULL, p_phone_last_digits text DEFAULT NULL,
  p_city_uf text DEFAULT NULL, p_neighborhood text DEFAULT NULL,
  p_profession text DEFAULT NULL, p_plate_prefix text DEFAULT NULL,
  p_age_approx integer DEFAULT NULL,
  p_forca_seguranca boolean DEFAULT NULL, p_tem_arma boolean DEFAULT NULL,
  p_cor_raca text DEFAULT NULL, p_escolaridade text DEFAULT NULL,
  p_company text DEFAULT NULL, p_xingamentos text DEFAULT NULL,
  p_cpf_last4 text DEFAULT NULL
)
RETURNS TABLE(
  id uuid, nome text, display_name_masked text, name_normalized text,
  data_nascimento date, aliases text[], approx_age_min integer, approx_age_max integer,
  father_first_name text, father_name_partial_normalized text,
  mother_first_name text, mother_name_partial_normalized text,
  primary_city_uf text, neighborhoods text[], reference_points text[],
  profession text, sector text, company_public text,
  phone_clues jsonb, vehicles jsonb,
  forca_seguranca boolean, tem_arma_em_casa boolean,
  cor_raca text, escolaridade text, xingamentos_frequentes text[],
  cpf_last4 text,
  risk_score integer, risk_level text, violence_profile_probs jsonb,
  flags text[], quality_score integer, appearance_tags text[],
  last_incident_at timestamptz, total_vinculos bigint, name_similarity real
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  norm_name text := public.normalize_text(p_name);
  norm_father text := public.normalize_text(p_father_first);
  norm_mother text := public.normalize_text(p_mother_first);
  norm_city text := public.normalize_text(p_city_uf);
  norm_prof text := public.normalize_text(p_profession);
  norm_alias text := public.normalize_text(p_alias);
  norm_neighborhood text := public.normalize_text(p_neighborhood);
  norm_company text := public.normalize_text(p_company);
  criteria_count integer := 0;
BEGIN
  IF norm_name != '' THEN criteria_count := criteria_count + 1; END IF;
  IF norm_father != '' THEN criteria_count := criteria_count + 1; END IF;
  IF norm_mother != '' THEN criteria_count := criteria_count + 1; END IF;
  IF norm_city != '' THEN criteria_count := criteria_count + 1; END IF;
  IF norm_prof != '' THEN criteria_count := criteria_count + 1; END IF;
  IF norm_alias != '' THEN criteria_count := criteria_count + 1; END IF;
  IF norm_neighborhood != '' THEN criteria_count := criteria_count + 1; END IF;
  IF norm_company != '' THEN criteria_count := criteria_count + 1; END IF;
  IF p_ddd IS NOT NULL AND p_ddd != '' THEN criteria_count := criteria_count + 1; END IF;
  IF p_phone_last_digits IS NOT NULL AND p_phone_last_digits != '' THEN criteria_count := criteria_count + 1; END IF;
  IF p_plate_prefix IS NOT NULL AND p_plate_prefix != '' THEN criteria_count := criteria_count + 1; END IF;
  IF p_age_approx IS NOT NULL THEN criteria_count := criteria_count + 1; END IF;
  IF p_forca_seguranca IS NOT NULL THEN criteria_count := criteria_count + 1; END IF;
  IF p_tem_arma IS NOT NULL THEN criteria_count := criteria_count + 1; END IF;
  IF p_cor_raca IS NOT NULL THEN criteria_count := criteria_count + 1; END IF;
  IF p_escolaridade IS NOT NULL THEN criteria_count := criteria_count + 1; END IF;
  IF p_xingamentos IS NOT NULL AND p_xingamentos != '' THEN criteria_count := criteria_count + 1; END IF;
  IF p_cpf_last4 IS NOT NULL AND p_cpf_last4 != '' THEN criteria_count := criteria_count + 1; END IF;

  RETURN QUERY
  SELECT
    a.id, a.nome, a.display_name_masked, a.name_normalized,
    a.data_nascimento, a.aliases, a.approx_age_min, a.approx_age_max,
    a.father_first_name, a.father_name_partial_normalized,
    a.mother_first_name, a.mother_name_partial_normalized,
    a.primary_city_uf, a.neighborhoods, a.reference_points,
    a.profession, a.sector, a.company_public,
    a.phone_clues, a.vehicles,
    a.forca_seguranca, a.tem_arma_em_casa,
    a.cor_raca, a.escolaridade, a.xingamentos_frequentes,
    a.cpf_last4,
    a.risk_score, a.risk_level, a.violence_profile_probs,
    a.flags, a.quality_score, a.appearance_tags,
    a.last_incident_at,
    (SELECT count(*) FROM vitimas_agressores va WHERE va.agressor_id = a.id) AS total_vinculos,
    CASE WHEN norm_name != '' THEN similarity(a.name_normalized, norm_name) ELSE 0::real END AS name_similarity
  FROM agressores a
  WHERE (
    (norm_name != '' AND similarity(a.name_normalized, norm_name) > 0.25)
    OR (norm_alias != '' AND norm_alias = ANY(SELECT public.normalize_text(x) FROM unnest(a.aliases) x))
    OR (norm_father != '' AND (
      similarity(coalesce(public.normalize_text(a.father_first_name), ''), norm_father) > 0.6
      OR similarity(coalesce(a.father_name_partial_normalized, ''), norm_father) > 0.45
    ))
    OR (norm_mother != '' AND (
      similarity(coalesce(public.normalize_text(a.mother_first_name), ''), norm_mother) > 0.6
      OR similarity(coalesce(a.mother_name_partial_normalized, ''), norm_mother) > 0.45
    ))
    OR (norm_city != '' AND similarity(coalesce(public.normalize_text(a.primary_city_uf), ''), norm_city) > 0.7)
    OR (norm_neighborhood != '' AND norm_neighborhood = ANY(SELECT public.normalize_text(n) FROM unnest(a.neighborhoods) n))
    OR (norm_prof != '' AND similarity(coalesce(public.normalize_text(a.profession), ''), norm_prof) > 0.45)
    OR (p_ddd IS NOT NULL AND p_ddd != '' AND p_phone_last_digits IS NOT NULL AND p_phone_last_digits != '' 
        AND a.phone_clues::text LIKE '%"ddd":"' || p_ddd || '"%'
        AND a.phone_clues::text LIKE '%' || p_phone_last_digits || '%')
    OR (p_phone_last_digits IS NOT NULL AND length(p_phone_last_digits) >= 4 AND a.phone_clues::text LIKE '%' || p_phone_last_digits || '%')
    OR (p_plate_prefix IS NOT NULL AND p_plate_prefix != '' AND length(p_plate_prefix) >= 3 AND a.vehicles::text ILIKE '%' || p_plate_prefix || '%')
    OR (p_age_approx IS NOT NULL AND (
      (a.approx_age_min IS NOT NULL AND p_age_approx BETWEEN a.approx_age_min - 3 AND coalesce(a.approx_age_max, a.approx_age_min) + 3)
      OR (a.data_nascimento IS NOT NULL AND abs(extract(year FROM age(a.data_nascimento)) - p_age_approx) <= 3)
    ))
    OR (norm_company != '' AND similarity(coalesce(public.normalize_text(a.company_public), ''), norm_company) > 0.45)
    OR (p_xingamentos IS NOT NULL AND p_xingamentos != '' AND EXISTS (
      SELECT 1 FROM unnest(a.xingamentos_frequentes) xf WHERE public.normalize_text(xf) % public.normalize_text(p_xingamentos)
    ))
    OR (p_cpf_last4 IS NOT NULL AND p_cpf_last4 != '' AND a.cpf_last4 = p_cpf_last4)
  )
  AND (
    criteria_count <= 1
    OR (
      (CASE WHEN norm_name != '' AND similarity(a.name_normalized, norm_name) > 0.25 THEN 1 ELSE 0 END) +
      (CASE WHEN norm_alias != '' AND norm_alias = ANY(SELECT public.normalize_text(x) FROM unnest(a.aliases) x) THEN 1 ELSE 0 END) +
      (CASE WHEN norm_father != '' AND (similarity(coalesce(public.normalize_text(a.father_first_name), ''), norm_father) > 0.6 OR similarity(coalesce(a.father_name_partial_normalized, ''), norm_father) > 0.45) THEN 1 ELSE 0 END) +
      (CASE WHEN norm_mother != '' AND (similarity(coalesce(public.normalize_text(a.mother_first_name), ''), norm_mother) > 0.6 OR similarity(coalesce(a.mother_name_partial_normalized, ''), norm_mother) > 0.45) THEN 1 ELSE 0 END) +
      (CASE WHEN norm_city != '' AND similarity(coalesce(public.normalize_text(a.primary_city_uf), ''), norm_city) > 0.7 THEN 1 ELSE 0 END) +
      (CASE WHEN norm_neighborhood != '' AND norm_neighborhood = ANY(SELECT public.normalize_text(n) FROM unnest(a.neighborhoods) n) THEN 1 ELSE 0 END) +
      (CASE WHEN norm_prof != '' AND similarity(coalesce(public.normalize_text(a.profession), ''), norm_prof) > 0.45 THEN 1 ELSE 0 END) +
      (CASE WHEN p_ddd IS NOT NULL AND p_ddd != '' AND a.phone_clues::text LIKE '%"ddd":"' || p_ddd || '"%' THEN 1 ELSE 0 END) +
      (CASE WHEN p_phone_last_digits IS NOT NULL AND p_phone_last_digits != '' AND a.phone_clues::text LIKE '%' || p_phone_last_digits || '%' THEN 1 ELSE 0 END) +
      (CASE WHEN p_plate_prefix IS NOT NULL AND p_plate_prefix != '' AND a.vehicles::text ILIKE '%' || p_plate_prefix || '%' THEN 1 ELSE 0 END) +
      (CASE WHEN p_age_approx IS NOT NULL AND ((a.approx_age_min IS NOT NULL AND p_age_approx BETWEEN a.approx_age_min - 3 AND coalesce(a.approx_age_max, a.approx_age_min) + 3) OR (a.data_nascimento IS NOT NULL AND abs(extract(year FROM age(a.data_nascimento)) - p_age_approx) <= 3)) THEN 1 ELSE 0 END) +
      (CASE WHEN norm_company != '' AND similarity(coalesce(public.normalize_text(a.company_public), ''), norm_company) > 0.45 THEN 1 ELSE 0 END) +
      (CASE WHEN p_xingamentos IS NOT NULL AND p_xingamentos != '' AND EXISTS (SELECT 1 FROM unnest(a.xingamentos_frequentes) xf WHERE public.normalize_text(xf) % public.normalize_text(p_xingamentos)) THEN 1 ELSE 0 END) +
      (CASE WHEN p_cpf_last4 IS NOT NULL AND p_cpf_last4 != '' AND a.cpf_last4 = p_cpf_last4 THEN 1 ELSE 0 END)
    ) >= 2
  )
  AND NOT (
    criteria_count >= 2
    AND norm_name = '' AND norm_alias = '' AND norm_father = '' AND norm_mother = ''
    AND (p_ddd IS NULL OR p_ddd = '') AND (p_phone_last_digits IS NULL OR p_phone_last_digits = '')
    AND norm_prof = '' AND norm_company = ''
    AND (p_plate_prefix IS NULL OR p_plate_prefix = '')
    AND (p_xingamentos IS NULL OR p_xingamentos = '')
    AND (p_cpf_last4 IS NULL OR p_cpf_last4 = '')
  )
  ORDER BY name_similarity DESC, a.quality_score DESC
  LIMIT 30;
END;
$function$;