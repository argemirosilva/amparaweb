ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cpf_hash text;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cpf_last4 text;