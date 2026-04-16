import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminRole = "super_administrador" | "administrador" | "admin_master" | "admin_tenant" | "operador" | "suporte" | "magistrado";

export function useAdminRole() {
  const { usuario } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [tenantSigla, setTenantSigla] = useState<string | null>(null);
  const [tenantUf, setTenantUf] = useState<string | null>(null);
  const [telasPermitidas, setTelasPermitidas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario?.id) {
      setRoles([]);
      setTenantSigla(null);
      setTenantUf(null);
      setTelasPermitidas([]);
      setLoading(false);
      return;
    }

    async function fetchRoles() {
      const { data } = await supabase
        .from("user_roles")
        .select("role, tenant_id")
        .eq("user_id", usuario!.id);

      const rolesArr = (data || []).map((r: any) => r.role as AdminRole);
      setRoles(rolesArr);

      // Fetch tenant data if user has a tenant_id
      const tenantId = (data || []).find((r: any) => r.tenant_id)?.tenant_id;
      if (tenantId) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("sigla, uf, telas_permitidas")
          .eq("id", tenantId)
          .maybeSingle();
        setTenantSigla(tenant?.sigla || null);
        setTenantUf(tenant?.uf || null);
        const telas = (tenant as any)?.telas_permitidas;
        setTelasPermitidas(Array.isArray(telas) ? telas : []);
      } else {
        setTenantSigla(null);
        setTenantUf(null);
        setTelasPermitidas([]);
      }

      setLoading(false);
    }

    fetchRoles();
  }, [usuario?.id]);

  const hasRole = useCallback(
    (role: AdminRole) => roles.includes(role),
    [roles]
  );

  const isSuperAdmin = roles.includes("super_administrador");
  const isAdministrador = isSuperAdmin || roles.includes("administrador");
  const isAdmin = roles.some((r) => ["super_administrador", "administrador", "admin_master", "admin_tenant"].includes(r));
  const isOperador = roles.includes("operador");
  const isSuporte = roles.includes("suporte");
  const isMagistrado = roles.includes("magistrado");
  const hasAnyAdminAccess = isAdmin || isOperador || isSuporte || isMagistrado;

  return {
    roles, loading, hasRole,
    isAdmin, isAdministrador, isSuperAdmin, isOperador, isSuporte, isMagistrado,
    hasAnyAdminAccess,
    tenantSigla, tenantUf, telasPermitidas,
  };
}
