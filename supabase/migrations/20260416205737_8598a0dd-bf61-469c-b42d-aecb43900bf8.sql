-- 1. Tenants: escopo geográfico
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS escopo_geografico text NOT NULL DEFAULT 'municipal',
  ADD COLUMN IF NOT EXISTS acesso_nacional boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_escopo_geografico_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_escopo_geografico_check
  CHECK (escopo_geografico IN ('nacional', 'estadual', 'municipal'));

-- Trigger: manter acesso_nacional consistente com escopo_geografico
CREATE OR REPLACE FUNCTION public.sync_tenant_acesso_nacional()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.acesso_nacional := (NEW.escopo_geografico = 'nacional');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_acesso_nacional ON public.tenants;
CREATE TRIGGER trg_sync_tenant_acesso_nacional
  BEFORE INSERT OR UPDATE OF escopo_geografico ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_acesso_nacional();

-- 2. user_roles: telas e escopo por usuário
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS telas_permitidas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escopo_uf text,
  ADD COLUMN IF NOT EXISTS escopo_cidade text;

-- 3. Validador: telas/escopo do usuário ⊆ entidade (com bypass para roles globais)
CREATE OR REPLACE FUNCTION public.validate_user_role_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_role text;
  v_tela text;
  v_telas_tenant jsonb;
BEGIN
  v_role := NEW.role::text;

  -- Bypass para roles globais
  IF v_role IN ('super_administrador', 'administrador', 'suporte', 'magistrado') THEN
    RETURN NEW;
  END IF;

  -- Demais roles exigem tenant
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com papel % requer vínculo a uma entidade', v_role;
  END IF;

  SELECT escopo_geografico, uf, cidade, telas_permitidas
    INTO v_tenant
    FROM public.tenants
   WHERE id = NEW.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entidade % não encontrada', NEW.tenant_id;
  END IF;

  -- Validar escopo geográfico: usuário ⊆ entidade
  IF v_tenant.escopo_geografico = 'municipal' THEN
    IF NEW.escopo_uf IS NOT NULL AND NEW.escopo_uf <> v_tenant.uf THEN
      RAISE EXCEPTION 'UF do usuário (%) deve coincidir com a UF da entidade (%)', NEW.escopo_uf, v_tenant.uf;
    END IF;
    IF NEW.escopo_cidade IS NOT NULL AND NEW.escopo_cidade <> v_tenant.cidade THEN
      RAISE EXCEPTION 'Cidade do usuário (%) deve coincidir com a cidade da entidade (%)', NEW.escopo_cidade, v_tenant.cidade;
    END IF;
  ELSIF v_tenant.escopo_geografico = 'estadual' THEN
    IF NEW.escopo_uf IS NOT NULL AND NEW.escopo_uf <> v_tenant.uf THEN
      RAISE EXCEPTION 'UF do usuário (%) deve coincidir com a UF da entidade (%)', NEW.escopo_uf, v_tenant.uf;
    END IF;
    -- escopo_cidade é livre (pode ser qualquer cidade da UF)
  END IF;
  -- nacional: sem restrição

  -- Validar telas: user ⊆ tenant (apenas se tenant tem lista definida e usuário definiu telas)
  v_telas_tenant := COALESCE(v_tenant.telas_permitidas, '[]'::jsonb);
  IF jsonb_array_length(v_telas_tenant) > 0 AND jsonb_array_length(COALESCE(NEW.telas_permitidas, '[]'::jsonb)) > 0 THEN
    FOR v_tela IN SELECT jsonb_array_elements_text(NEW.telas_permitidas) LOOP
      IF NOT (v_telas_tenant ? v_tela) THEN
        RAISE EXCEPTION 'Tela % não está liberada para a entidade', v_tela;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_user_role_scope ON public.user_roles;
CREATE TRIGGER trg_validate_user_role_scope
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_role_scope();