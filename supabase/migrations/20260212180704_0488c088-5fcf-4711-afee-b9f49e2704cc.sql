ALTER TABLE public.usuarios
ADD COLUMN compartilhar_gps_panico boolean NOT NULL DEFAULT true,
ADD COLUMN compartilhar_gps_risco_alto boolean NOT NULL DEFAULT true;