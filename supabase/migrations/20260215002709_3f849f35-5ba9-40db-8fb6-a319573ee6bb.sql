
-- Enable extensions for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Normalize text function
CREATE OR REPLACE FUNCTION public.normalize_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN lower(public.unaccent(coalesce(input, '')));
END;
$$;

-- ========== Expand agressores table ==========
ALTER TABLE public.agressores
ADD COLUMN IF NOT EXISTS name_normalized text,
ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS approx_age_min integer,
ADD COLUMN IF NOT EXISTS approx_age_max integer,
ADD COLUMN IF NOT EXISTS father_first_name text,
ADD COLUMN IF NOT EXISTS father_name_partial_normalized text,
ADD COLUMN IF NOT EXISTS mother_first_name text,
ADD COLUMN IF NOT EXISTS mother_name_partial_normalized text,
ADD COLUMN IF NOT EXISTS phone_clues jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS email_clues jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS primary_city_uf text,
ADD COLUMN IF NOT EXISTS neighborhoods text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reference_points text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS geo_area_tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS profession text,
ADD COLUMN IF NOT EXISTS sector text,
ADD COLUMN IF NOT EXISTS company_public text,
ADD COLUMN IF NOT EXISTS vehicles jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS appearance_notes text,
ADD COLUMN IF NOT EXISTS appearance_tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS risk_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'baixo',
ADD COLUMN IF NOT EXISTS violence_profile_probs jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_incident_at timestamptz,
ADD COLUMN IF NOT EXISTS flags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS search_tokens text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS display_name_masked text;

-- Trigger to auto-populate normalized fields on insert/update
CREATE OR REPLACE FUNCTION public.agressores_normalize_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.name_normalized := public.normalize_text(NEW.nome);
  
  -- Auto-generate display_name_masked
  IF NEW.display_name_masked IS NULL OR NEW.display_name_masked = '' THEN
    NEW.display_name_masked := (
      SELECT string_agg(
        CASE WHEN length(w) <= 1 THEN w ELSE substr(w, 1, 1) || repeat('*', least(length(w) - 1, 3)) END,
        ' '
      )
      FROM unnest(string_to_array(NEW.nome, ' ')) AS w
    );
  END IF;
  
  -- Extract father/mother first names from partial if not set
  IF NEW.father_first_name IS NULL AND NEW.nome_pai_parcial IS NOT NULL THEN
    NEW.father_first_name := split_part(trim(NEW.nome_pai_parcial), ' ', 1);
  END IF;
  NEW.father_name_partial_normalized := public.normalize_text(NEW.nome_pai_parcial);
  
  IF NEW.mother_first_name IS NULL AND NEW.nome_mae_parcial IS NOT NULL THEN
    NEW.mother_first_name := split_part(trim(NEW.nome_mae_parcial), ' ', 1);
  END IF;
  NEW.mother_name_partial_normalized := public.normalize_text(NEW.nome_mae_parcial);
  
  -- Extract phone clues from telefone if phone_clues empty
  IF NEW.telefone IS NOT NULL AND (NEW.phone_clues IS NULL OR NEW.phone_clues = '[]'::jsonb) THEN
    DECLARE
      digits text := regexp_replace(NEW.telefone, '\D', '', 'g');
    BEGIN
      IF length(digits) >= 10 THEN
        NEW.phone_clues := jsonb_build_array(jsonb_build_object(
          'ddd', substr(digits, 1, 2),
          'last_digits', substr(digits, length(digits) - 3)
        ));
      END IF;
    END;
  END IF;
  
  -- Build search_tokens
  NEW.search_tokens := ARRAY[]::text[];
  IF NEW.name_normalized IS NOT NULL AND NEW.name_normalized != '' THEN
    NEW.search_tokens := NEW.search_tokens || string_to_array(NEW.name_normalized, ' ');
  END IF;
  IF NEW.aliases IS NOT NULL THEN
    NEW.search_tokens := NEW.search_tokens || (SELECT array_agg(public.normalize_text(a)) FROM unnest(NEW.aliases) a WHERE a IS NOT NULL);
  END IF;
  IF NEW.father_first_name IS NOT NULL THEN
    NEW.search_tokens := NEW.search_tokens || ARRAY[public.normalize_text(NEW.father_first_name)];
  END IF;
  IF NEW.mother_first_name IS NOT NULL THEN
    NEW.search_tokens := NEW.search_tokens || ARRAY[public.normalize_text(NEW.mother_first_name)];
  END IF;
  IF NEW.primary_city_uf IS NOT NULL THEN
    NEW.search_tokens := NEW.search_tokens || ARRAY[public.normalize_text(NEW.primary_city_uf)];
  END IF;
  IF NEW.profession IS NOT NULL THEN
    NEW.search_tokens := NEW.search_tokens || ARRAY[public.normalize_text(NEW.profession)];
  END IF;
  
  -- Compute quality_score
  NEW.quality_score := 0;
  IF NEW.nome IS NOT NULL THEN NEW.quality_score := NEW.quality_score + 15; END IF;
  IF NEW.data_nascimento IS NOT NULL THEN NEW.quality_score := NEW.quality_score + 10; END IF;
  IF NEW.telefone IS NOT NULL THEN NEW.quality_score := NEW.quality_score + 15; END IF;
  IF NEW.nome_pai_parcial IS NOT NULL THEN NEW.quality_score := NEW.quality_score + 10; END IF;
  IF NEW.nome_mae_parcial IS NOT NULL THEN NEW.quality_score := NEW.quality_score + 10; END IF;
  IF NEW.primary_city_uf IS NOT NULL THEN NEW.quality_score := NEW.quality_score + 10; END IF;
  IF NEW.profession IS NOT NULL THEN NEW.quality_score := NEW.quality_score + 5; END IF;
  IF array_length(NEW.neighborhoods, 1) > 0 THEN NEW.quality_score := NEW.quality_score + 5; END IF;
  IF NEW.vehicles IS NOT NULL AND NEW.vehicles != '[]'::jsonb THEN NEW.quality_score := NEW.quality_score + 10; END IF;
  IF array_length(NEW.aliases, 1) > 0 THEN NEW.quality_score := NEW.quality_score + 5; END IF;
  IF NEW.forca_seguranca THEN NEW.quality_score := NEW.quality_score + 5; END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER agressores_normalize
BEFORE INSERT OR UPDATE ON public.agressores
FOR EACH ROW
EXECUTE FUNCTION public.agressores_normalize_trigger();

-- Backfill existing records
UPDATE public.agressores SET updated_at = now() WHERE name_normalized IS NULL;

-- ========== Create aggressor_incidents table ==========
CREATE TABLE public.aggressor_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aggressor_id uuid NOT NULL REFERENCES public.agressores(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES public.usuarios(id),
  occurred_at_month text,
  violence_types text[] DEFAULT '{}',
  severity integer DEFAULT 3,
  pattern_tags text[] DEFAULT '{}',
  description_sanitized text,
  source_type text DEFAULT 'usuaria',
  confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aggressor_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access aggressor_incidents"
ON public.aggressor_incidents
AS RESTRICTIVE
FOR ALL
USING (false);

-- ========== Indexes for search ==========
CREATE INDEX IF NOT EXISTS idx_agressores_name_trgm ON public.agressores USING gin (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agressores_search_tokens ON public.agressores USING gin (search_tokens);
CREATE INDEX IF NOT EXISTS idx_agressores_city ON public.agressores (primary_city_uf);
CREATE INDEX IF NOT EXISTS idx_agressores_father_trgm ON public.agressores USING gin (father_name_partial_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agressores_mother_trgm ON public.agressores USING gin (mother_name_partial_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_aggressor_incidents_aggressor ON public.aggressor_incidents (aggressor_id);

-- ========== Search candidates function (Phase A - recall) ==========
CREATE OR REPLACE FUNCTION public.search_agressor_candidates(
  p_name text DEFAULT NULL,
  p_alias text DEFAULT NULL,
  p_father_first text DEFAULT NULL,
  p_mother_first text DEFAULT NULL,
  p_ddd text DEFAULT NULL,
  p_phone_last_digits text DEFAULT NULL,
  p_city_uf text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_profession text DEFAULT NULL,
  p_plate_prefix text DEFAULT NULL,
  p_age_approx integer DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nome text,
  display_name_masked text,
  name_normalized text,
  data_nascimento date,
  aliases text[],
  approx_age_min integer,
  approx_age_max integer,
  father_first_name text,
  father_name_partial_normalized text,
  mother_first_name text,
  mother_name_partial_normalized text,
  primary_city_uf text,
  neighborhoods text[],
  reference_points text[],
  profession text,
  sector text,
  phone_clues jsonb,
  vehicles jsonb,
  forca_seguranca boolean,
  tem_arma_em_casa boolean,
  risk_score integer,
  risk_level text,
  violence_profile_probs jsonb,
  flags text[],
  quality_score integer,
  appearance_tags text[],
  last_incident_at timestamptz,
  total_vinculos bigint,
  name_similarity real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  norm_name text := public.normalize_text(p_name);
  norm_father text := public.normalize_text(p_father_first);
  norm_mother text := public.normalize_text(p_mother_first);
  norm_city text := public.normalize_text(p_city_uf);
  norm_prof text := public.normalize_text(p_profession);
  norm_alias text := public.normalize_text(p_alias);
  norm_neighborhood text := public.normalize_text(p_neighborhood);
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.nome,
    a.display_name_masked,
    a.name_normalized,
    a.data_nascimento,
    a.aliases,
    a.approx_age_min,
    a.approx_age_max,
    a.father_first_name,
    a.father_name_partial_normalized,
    a.mother_first_name,
    a.mother_name_partial_normalized,
    a.primary_city_uf,
    a.neighborhoods,
    a.reference_points,
    a.profession,
    a.sector,
    a.phone_clues,
    a.vehicles,
    a.forca_seguranca,
    a.tem_arma_em_casa,
    a.risk_score,
    a.risk_level,
    a.violence_profile_probs,
    a.flags,
    a.quality_score,
    a.appearance_tags,
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
  )
  ORDER BY name_similarity DESC, a.quality_score DESC
  LIMIT 200;
END;
$$;
