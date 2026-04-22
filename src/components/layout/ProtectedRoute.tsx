import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { consumeSsoToken } from "@/services/webApiService";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading, setSessionFromToken } = useAuth();
  const location = useLocation();
  const ranRef = useRef(false);
  const [ssoState, setSsoState] = useState<"idle" | "consuming" | "done">("idle");

  // Detecta token SSO (?t=...) na URL e tenta hidratar a sessão silenciosamente
  // antes de decidir entre renderizar conteúdo ou redirecionar para /login.
  useEffect(() => {
    if (ranRef.current) return;
    const params = new URLSearchParams(location.search);
    const ssoToken = params.get("t");
    if (!ssoToken) return;
    ranRef.current = true;

    // Limpa o token da URL imediatamente (evita vazamento via referer/histórico)
    try {
      window.history.replaceState(null, "", location.pathname);
    } catch {
      // ignore
    }

    setSsoState("consuming");
    (async () => {
      try {
        const { ok, data } = await consumeSsoToken(ssoToken);
        if (ok && data?.success && data?.session?.token) {
          await setSessionFromToken(data.session.token);
        }
      } catch {
        // silencioso: cai no fluxo normal de auth
      }
      setSsoState("done");
    })();
  }, [location.pathname, location.search, setSessionFromToken]);

  if (loading || ssoState === "consuming") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (!usuario.onboarding_completo) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
