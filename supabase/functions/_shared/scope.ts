// Helper de escopo geográfico/papel para edge functions.
// Roles globais (super/admin/suporte/magistrado) bypassam filtro geográfico.

export type Scope = "nacional" | "estadual" | "municipal";

export interface UserScope {
  userId: string;
  isGlobal: boolean;        // bypassa qualquer filtro geográfico
  scope: Scope;
  uf: string | null;
  cidade: string | null;
  roles: string[];
}

const GLOBAL_ROLES = new Set([
  "super_administrador",
  "administrador",
  "suporte",
  "magistrado",
]);

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getUserScope(supabase: any, sessionToken: string): Promise<UserScope | null> {
  if (!sessionToken) return null;
  const tokenHash = await sha256Hex(sessionToken);

  const { data: session } = await supabase
    .from("user_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  const { data: rolesRows } = await supabase
    .from("user_roles")
    .select("role, tenant_id, escopo_uf, escopo_cidade")
    .eq("user_id", session.user_id);

  const roles: string[] = (rolesRows || []).map((r: any) => r.role);

  // Global bypass
  if (roles.some((r) => GLOBAL_ROLES.has(r))) {
    return {
      userId: session.user_id,
      isGlobal: true,
      scope: "nacional",
      uf: null,
      cidade: null,
      roles,
    };
  }

  // Sem role admin -> sem acesso
  if (roles.length === 0) return null;

  // Pega o primeiro user_role com tenant
  const roleWithTenant = (rolesRows || []).find((r: any) => r.tenant_id);
  if (!roleWithTenant) {
    return {
      userId: session.user_id,
      isGlobal: false,
      scope: "municipal",
      uf: null,
      cidade: null,
      roles,
    };
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("escopo_geografico, uf, cidade, acesso_nacional")
    .eq("id", roleWithTenant.tenant_id)
    .maybeSingle();

  // Override por usuário (operador pode ser restrito a uma cidade da UF da entidade)
  const userUf = roleWithTenant.escopo_uf || tenant?.uf || null;
  const userCidade = roleWithTenant.escopo_cidade || tenant?.cidade || null;
  const tenantScope = (tenant?.escopo_geografico as Scope) || "municipal";

  // Se o operador tem cidade específica, escopo efetivo é municipal
  let effectiveScope: Scope = tenantScope;
  if (roleWithTenant.escopo_cidade) {
    effectiveScope = "municipal";
  } else if (roleWithTenant.escopo_uf && tenantScope === "nacional") {
    effectiveScope = "estadual";
  }

  return {
    userId: session.user_id,
    isGlobal: tenant?.acesso_nacional === true || tenantScope === "nacional",
    scope: effectiveScope,
    uf: userUf,
    cidade: userCidade,
    roles,
  };
}

/**
 * Aplica o filtro geográfico em uma query do supabase-js sobre a tabela `usuarios`
 * (ou alias). Retorna a query modificada.
 */
export function applyScopeToUsuariosQuery(query: any, scope: UserScope, alias = ""): any {
  if (scope.isGlobal) return query;
  const ufCol = alias ? `${alias}.endereco_uf` : "endereco_uf";
  const cidadeCol = alias ? `${alias}.endereco_cidade` : "endereco_cidade";
  if (scope.scope === "nacional") return query;
  if (scope.scope === "estadual" && scope.uf) {
    return query.eq(ufCol, scope.uf);
  }
  if (scope.scope === "municipal") {
    let q = query;
    if (scope.uf) q = q.eq(ufCol, scope.uf);
    if (scope.cidade) q = q.eq(cidadeCol, scope.cidade);
    return q;
  }
  return query;
}

/**
 * Verifica se uma vítima (linha de `usuarios` com `endereco_uf`/`endereco_cidade`)
 * está dentro do escopo do usuário.
 */
export function isVitimaInScope(
  vitima: { endereco_uf?: string | null; endereco_cidade?: string | null },
  scope: UserScope
): boolean {
  if (scope.isGlobal || scope.scope === "nacional") return true;
  if (scope.scope === "estadual") {
    return !scope.uf || (vitima.endereco_uf || "").toUpperCase() === scope.uf.toUpperCase();
  }
  if (scope.scope === "municipal") {
    const ufOk = !scope.uf || (vitima.endereco_uf || "").toUpperCase() === scope.uf.toUpperCase();
    const cidOk = !scope.cidade || (vitima.endereco_cidade || "").toLowerCase() === scope.cidade.toLowerCase();
    return ufOk && cidOk;
  }
  return true;
}
