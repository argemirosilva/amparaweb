ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS endereco_lat double precision,
  ADD COLUMN IF NOT EXISTS endereco_lon double precision;