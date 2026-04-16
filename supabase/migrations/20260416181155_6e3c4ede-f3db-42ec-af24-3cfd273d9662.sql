-- Adiciona novo papel Magistrado ao enum admin_role
ALTER TYPE public.admin_role ADD VALUE IF NOT EXISTS 'magistrado';

-- Adiciona coluna telas_permitidas em tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS telas_permitidas jsonb NOT NULL DEFAULT '[]'::jsonb;