
-- Drop the OLD overload (17 params, without p_cpf_last4) that causes PGRST203 ambiguity
DROP FUNCTION IF EXISTS public.search_agressor_candidates(
  text, text, text, text, text, text, text, text, text, text, integer, boolean, boolean, text, text, text, text
);
