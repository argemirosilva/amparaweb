import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminRole = "admin_master" | "admin_tenant" | "operador";

export function useAdminRole() {
  const { usuario } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario?.id) {
      setRoles([]);
      setLoading(false);
      return;
    }

    async function fetchRoles() {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", usuario!.id);

      setRoles((data || []).map((r: any) => r.role as AdminRole));
      setLoading(false);
    }

    fetchRoles();
  }, [usuario?.id]);

  const hasRole = useCallback(
    (role: AdminRole) => roles.includes(role),
    [roles]
  );

  const isAdmin = roles.some((r) => r === "admin_master" || r === "admin_tenant");
  const isOperador = roles.includes("operador");
  const hasAnyAdminAccess = isAdmin || isOperador;

  return { roles, loading, hasRole, isAdmin, isOperador, hasAnyAdminAccess };
}
