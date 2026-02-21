
-- Add cor and escolaridade to usuarios (victim)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS cor_raca text,
  ADD COLUMN IF NOT EXISTS escolaridade text;

-- Add cor and escolaridade to agressores (aggressor)
ALTER TABLE public.agressores
  ADD COLUMN IF NOT EXISTS cor_raca text,
  ADD COLUMN IF NOT EXISTS escolaridade text;
