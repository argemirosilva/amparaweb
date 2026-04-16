import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminRole = "super_administrador" | "administrador" | "admin_master" | "admin_tenant" | "operador" | "suporte" | "magistrado";

export type EscopoGeografico = "nacional" | "estadual" | "municipal";

export function useAdminRole() {
  const { usuario } = useAuth();
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantSigla, setTenantSigla] = useState<string | null>(null);
  const [tenantUf, setTenantUf] = useState<string | null>(null);
  const [tenantCidade, setTenantCidade] = useState<string | null>(null);
  const [escopoGeografico, setEscopoGeografico] = useState<EscopoGeografico>("municipal");
  const [acessoNacional, setAcessoNacional] = useState<boolean>(false);
  const [telasPermitidas, setTelasPermitidas] = useState<string[]>([]);
  // Telas e escopo do user_role (subset)
  const [userTelas, setUserTelas] = useState<string[]>([]);
  const [escopoUf, setEscopoUf] = useState<string | null>(null);
  const [escopoCidade, setEscopoCidade] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario?.id) {
      setRoles([]);
      setTenantId(null);
      setTenantSigla(null);
      setTenantUf(null);
      setTenantCidade(null);
      setEscopoGeografico("municipal");
      setAcessoNacional(false);
      setTelasPermitidas([]);
      setUserTelas([]);
      setEscopoUf(null);
      setEscopoCidade(null);
      setLoading(false);
      return;
    }

    async function fetchRoles() {
      const { data } = await supabase
        .from("user_roles")
        .select("role, tenant_id, telas_permitidas, escopo_uf, escopo_cidade")
        .eq("user_id", usuario!.id);

      const rolesArr = (data || []).map((r: any) => r.role as AdminRole);
      setRoles(rolesArr);

      const roleWithTenant = (data || []).find((r: any) => r.tenant_id);
      const tId = roleWithTenant?.tenant_id || null;
      setTenantId(tId);

      // user_role: telas e escopo individual (subset)
      const ut = roleWithTenant?.telas_permitidas;
      setUserTelas(Array.isArray(ut) ? (ut as any[]).filter((x) => typeof x === "string") as string[] : []);
      setEscopoUf(roleWithTenant?.escopo_uf || null);
      setEscopoCidade(roleWithTenant?.escopo_cidade || null);

      if (tId) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("sigla, uf, cidade, telas_permitidas, escopo_geografico, acesso_nacional")
          .eq("id", tId)
          .maybeSingle();
        setTenantSigla(tenant?.sigla || null);
        setTenantUf(tenant?.uf || null);
        setTenantCidade((tenant as any)?.cidade || null);
        setEscopoGeografico(((tenant as any)?.escopo_geografico as EscopoGeografico) || "municipal");
        setAcessoNacional((tenant as any)?.acesso_nacional === true);
        const telas = (tenant as any)?.telas_permitidas;
        setTelasPermitidas(Array.isArray(telas) ? telas : []);
      } else {
        setTenantSigla(null);
        setTenantUf(null);
        setTenantCidade(null);
        setEscopoGeografico("municipal");
        setAcessoNacional(false);
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
  const isAdminTenant = roles.includes("admin_tenant");
  const isOperador = roles.includes("operador");
  const isSuporte = roles.includes("suporte");
  const isMagistrado = roles.includes("magistrado");
  const hasAnyAdminAccess = isAdmin || isOperador || isSuporte || isMagistrado;

  // telasEfetivas:
  //  - super/admin/suporte/magistrado => array vazio significa "todas"
  //  - admin_tenant => herda telas da entidade
  //  - operador => intersecção(tenant.telas, user_role.telas) ou só user_role.telas
  let telasEfetivas: string[] = [];
  if (isSuperAdmin || isAdministrador || isSuporte || isMagistrado) {
    telasEfetivas = []; // sem restrição
  } else if (isAdminTenant) {
    telasEfetivas = telasPermitidas; // herda da entidade
  } else if (isOperador) {
    if (userTelas.length > 0 && telasPermitidas.length > 0) {
      telasEfetivas = userTelas.filter((t) => telasPermitidas.includes(t));
    } else if (userTelas.length > 0) {
      telasEfetivas = userTelas;
    } else {
      telasEfetivas = telasPermitidas;
    }
  } else if (hasRole("admin_master")) {
    telasEfetivas = telasPermitidas;
  }

  return {
    roles, loading, hasRole,
    isAdmin, isAdministrador, isSuperAdmin, isAdminTenant, isOperador, isSuporte, isMagistrado,
    hasAnyAdminAccess,
    tenantId, tenantSigla, tenantUf, tenantCidade,
    escopoGeografico, acessoNacional,
    telasPermitidas,            // telas da entidade
    userTelas,                  // telas do user_role (subset)
    telasEfetivas,              // efetivas para o usuário
    escopoUf, escopoCidade,     // escopo individual do operador
  };
}
