import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole, AdminRole } from "@/hooks/useAdminRole";

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
  requiredRole?: AdminRole;
}

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

export default function ProtectedAdminRoute({ children, requiredRole }: ProtectedAdminRouteProps) {
  const { usuario, loading: authLoading } = useAuth();
  const { hasAnyAdminAccess, hasRole, loading: rolesLoading } = useAdminRole();

  if (authLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(210 17% 96%)", ...fontStyle }}>
        <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Verificando permissões…</p>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
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
            style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
          >
            Voltar ao início
          </a>
        </div>
      </div>
    );
  }

  if (requiredRole && !hasRole(requiredRole)) {
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
