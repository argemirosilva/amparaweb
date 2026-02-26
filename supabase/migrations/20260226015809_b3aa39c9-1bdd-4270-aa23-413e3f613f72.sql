CREATE OR REPLACE FUNCTION public.search_agressor_candidates(
  p_name text DEFAULT NULL::text,
  p_alias text DEFAULT NULL::text,
  p_father_first text DEFAULT NULL::text,
  p_mother_first text DEFAULT NULL::text,
  p_ddd text DEFAULT NULL::text,
  p_phone_last_digits text DEFAULT NULL::text,
  p_city_uf text DEFAULT NULL::text,
  p_neighborhood text DEFAULT NULL::text,
  p_profession text DEFAULT NULL::text,
  p_plate_prefix text DEFAULT NULL::text,
  p_age_approx integer DEFAULT NULL::integer,
  p_forca_seguranca boolean DEFAULT NULL::boolean,
  p_tem_arma boolean DEFAULT NULL::boolean,
  p_cor_raca text DEFAULT NULL::text,
  p_escolaridade text DEFAULT NULL::text,
  p_company text DEFAULT NULL::text,
  p_xingamentos text DEFAULT NULL::text
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
  cor_raca text, escolaridade text,
  xingamentos_frequentes text[],
  risk_score integer, risk_level text, violence_profile_probs jsonb,
  flags text[], quality_score integer, appearance_tags text[],
  last_incident_at timestamp with time zone,
  total_vinculos bigint, name_similarity real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
BEGIN
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
    a.cor_raca, a.escolaridade,
    a.xingamentos_frequentes,
    a.risk_score, a.risk_level, a.violence_profile_probs,
    a.flags, a.quality_score, a.appearance_tags,
    a.last_incident_at,
    (SELECT count(*) FROM vitimas_agressores va WHERE va.agressor_id = a.id) AS total_vinculos,
    CASE 
      WHEN norm_name != '' THEN similarity(a.name_normalized, norm_name) 
      ELSE 0::real 
    END AS name_similarity
  FROM agressores a
  WHERE (
    (norm_name != '' AND similarity(a.name_normalized, norm_name) > 0.15)
    OR (norm_alias != '' AND norm_alias = ANY(SELECT public.normalize_text(x) FROM unnest(a.aliases) x))
    OR (norm_father != '' AND (
      similarity(coalesce(public.normalize_text(a.father_first_name), ''), norm_father) > 0.5
      OR similarity(coalesce(a.father_name_partial_normalized, ''), norm_father) > 0.3
    ))
    OR (norm_mother != '' AND (
      similarity(coalesce(public.normalize_text(a.mother_first_name), ''), norm_mother) > 0.5
      OR similarity(coalesce(a.mother_name_partial_normalized, ''), norm_mother) > 0.3
    ))
    OR (norm_city != '' AND a.primary_city_uf = norm_city)
    OR (norm_neighborhood != '' AND norm_neighborhood = ANY(SELECT public.normalize_text(n) FROM unnest(a.neighborhoods) n))
    OR (norm_prof != '' AND similarity(coalesce(public.normalize_text(a.profession), ''), norm_prof) > 0.3)
    OR (p_ddd IS NOT NULL AND p_ddd != '' AND a.phone_clues::text LIKE '%"ddd":"' || p_ddd || '"%')
    OR (p_phone_last_digits IS NOT NULL AND p_phone_last_digits != '' AND a.phone_clues::text LIKE '%' || p_phone_last_digits || '%')
    OR (p_plate_prefix IS NOT NULL AND p_plate_prefix != '' AND a.vehicles::text ILIKE '%' || p_plate_prefix || '%')
    OR (p_age_approx IS NOT NULL AND (
      (a.approx_age_min IS NOT NULL AND p_age_approx BETWEEN a.approx_age_min - 5 AND coalesce(a.approx_age_max, a.approx_age_min) + 5)
      OR (a.data_nascimento IS NOT NULL AND abs(extract(year FROM age(a.data_nascimento)) - p_age_approx) <= 5)
    ))
    OR (p_forca_seguranca IS NOT NULL AND a.forca_seguranca = p_forca_seguranca)
    OR (p_tem_arma IS NOT NULL AND a.tem_arma_em_casa = p_tem_arma)
    OR (p_cor_raca IS NOT NULL AND public.normalize_text(a.cor_raca) = public.normalize_text(p_cor_raca))
    OR (p_escolaridade IS NOT NULL AND public.normalize_text(a.escolaridade) = public.normalize_text(p_escolaridade))
    OR (norm_company != '' AND similarity(coalesce(public.normalize_text(a.company_public), ''), norm_company) > 0.3)
    OR (p_xingamentos IS NOT NULL AND p_xingamentos != '' AND EXISTS (
      SELECT 1 FROM unnest(a.xingamentos_frequentes) xf
      WHERE public.normalize_text(xf) % public.normalize_text(p_xingamentos)
    ))
  )
  ORDER BY name_similarity DESC, a.quality_score DESC
  LIMIT 200;
END;
$function$;