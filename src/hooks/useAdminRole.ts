import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminRole = "super_administrador" | "administrador" | "admin_master" | "admin_tenant" | "operador" | "suporte";

export function useAdminRole() {
  const { usuario } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [tenantSigla, setTenantSigla] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario?.id) {
      setRoles([]);
      setTenantSigla(null);
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

      // Fetch tenant sigla if user has a tenant_id
      const tenantId = (data || []).find((r: any) => r.tenant_id)?.tenant_id;
      if (tenantId) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("sigla")
          .eq("id", tenantId)
          .maybeSingle();
        setTenantSigla(tenant?.sigla || null);
      } else {
        setTenantSigla(null);
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
  const hasAnyAdminAccess = isAdmin || isOperador || isSuporte;

  return { roles, loading, hasRole, isAdmin, isAdministrador, isSuperAdmin, isOperador, isSuporte, hasAnyAdminAccess, tenantSigla };
}
