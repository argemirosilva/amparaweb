import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole, AdminRole } from "@/hooks/useAdminRole";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
  requiredRole?: AdminRole;
}

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

export default function ProtectedAdminRoute({ children, requiredRole }: ProtectedAdminRouteProps) {
  const { usuario, loading: authLoading } = useAuth();
  const { hasAnyAdminAccess, hasRole, isMagistrado, isSuperAdmin, isAdministrador, telasPermitidas, loading: rolesLoading } = useAdminRole();
  const { pathname } = useLocation();

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(210 17% 96%)", ...fontStyle }}>
        <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Verificando permissões…</p>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!hasAnyAdminAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(210 17% 96%)", ...fontStyle }}>
        <div
          className="rounded-md border p-8 text-center max-w-md"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          <h1 className="text-lg font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
            Acesso Restrito
          </h1>
          <p className="text-sm mb-4" style={{ color: "hsl(220 9% 46%)" }}>
            Você não possui permissão para acessar o painel administrativo.
          </p>
          <a
            href="/home"
            className="inline-block px-4 py-2 rounded text-sm font-semibold"
            style={{ background: "hsl(207 89% 42%)", color: "#fff" }}
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

  // Magistrado: acesso EXCLUSIVO a /admin/tribunal
  if (isMagistrado && !isSuperAdmin && !isAdministrador) {
    const isTribunalRoute = pathname === "/admin/tribunal" || pathname.startsWith("/admin/tribunal");
    if (!isTribunalRoute) {
      return <Navigate to="/admin/tribunal" replace />;
    }
  }

  // Filtro por telas_permitidas da entidade (quando configurado)
  // Não aplica para super_administrador/administrador (acesso total) e magistrado (já tratado acima)
  if (
    telasPermitidas.length > 0 &&
    !isSuperAdmin &&
    !isAdministrador &&
    !isMagistrado &&
    pathname.startsWith("/admin")
  ) {
    // /admin/login é sempre liberado; o próprio /admin (dashboard) precisa estar na lista se restringido
    const allowed = telasPermitidas.some((tela) => {
      if (tela === "/admin") return pathname === "/admin";
      return pathname === tela || pathname.startsWith(tela + "/");
    });
    if (!allowed) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(210 17% 96%)", ...fontStyle }}>
          <div
            className="rounded-md border p-8 text-center max-w-md"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
          >
            <h1 className="text-lg font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
              Tela não liberada
            </h1>
            <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>
              Esta tela não está habilitada para a sua entidade. Solicite acesso ao administrador.
            </p>
          </div>
        </div>
      );
    }
  }

  if (requiredRole && !hasRole(requiredRole) && !hasRole("super_administrador") && !hasRole("administrador")) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(210 17% 96%)", ...fontStyle }}>
        <div
          className="rounded-md border p-8 text-center max-w-md"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          <h1 className="text-lg font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
            Permissão Insuficiente
          </h1>
          <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>
            Seu perfil não possui a permissão necessária para esta seção.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
