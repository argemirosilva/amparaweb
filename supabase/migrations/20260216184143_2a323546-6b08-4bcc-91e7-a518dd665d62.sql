-- Enum de roles administrativas
CREATE TYPE public.admin_role AS ENUM ('admin_master', 'admin_tenant', 'operador');

-- Tabela de roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role admin_role NOT NULL,
  tenant_id text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS: somente leitura via anon (o sistema custom auth usa anon key)
CREATE POLICY "Allow anon select user_roles"
  ON public.user_roles FOR SELECT
  USING (true);

-- Negar INSERT/UPDATE/DELETE direto (gerenciado via edge functions)
CREATE POLICY "Block direct write user_roles"
  ON public.user_roles FOR ALL
  USING (false)
  WITH CHECK (false);

-- Permitir SELECT separadamente (a policy ALL restrictive não bloqueia o SELECT permissivo acima)

-- Função helper para checar role
CREATE OR REPLACE FUNCTION public.has_admin_role(p_user_id uuid, p_role admin_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;