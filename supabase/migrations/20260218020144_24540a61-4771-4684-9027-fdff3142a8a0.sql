
-- Validation trigger: admin_tenant and operador must have a valid tenant_id
CREATE OR REPLACE FUNCTION public.validate_user_role_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  -- admin_master does not require tenant
  IF NEW.role = 'admin_master' THEN
    RETURN NEW;
  END IF;

  -- admin_tenant and operador must have tenant_id
  IF NEW.tenant_id IS NULL OR NEW.tenant_id = '' THEN
    RAISE EXCEPTION 'Roles admin_tenant e operador devem estar associadas a um órgão (tenant_id obrigatório).';
  END IF;

  -- Validate tenant exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE id::text = NEW.tenant_id AND ativo = true
  ) THEN
    RAISE EXCEPTION 'O órgão informado não existe ou está inativo.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_user_role_tenant
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_user_role_tenant();
