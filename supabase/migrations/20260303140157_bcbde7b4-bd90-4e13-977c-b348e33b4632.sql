
ALTER TABLE public.aggressor_incidents
  DROP CONSTRAINT aggressor_incidents_reporter_user_id_fkey;

ALTER TABLE public.aggressor_incidents
  ADD CONSTRAINT aggressor_incidents_reporter_user_id_fkey
  FOREIGN KEY (reporter_user_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;
