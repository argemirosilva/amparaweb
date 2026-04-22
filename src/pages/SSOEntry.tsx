import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { consumeSsoToken } from "@/services/webApiService";
import logoAmpara from "@/assets/partner-hpe.svg";

/**
 * SSO Entry — Bridge silenciosa para acesso vindo do app mobile.
 * Lê ?t=<token> da URL, consome no backend, cria sessão web e redireciona.
 * Em qualquer falha, redireciona para /login sem expor motivo.
 */
export default function SSOEntry() {
  const navigate = useNavigate();
  const { setSessionFromToken } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      // 1. Lê token da URL
      const params = new URLSearchParams(window.location.search);
      const ssoToken = params.get("t");

      // 2. Limpa URL imediatamente para evitar token em referer/histórico
      try {
        window.history.replaceState(null, "", "/sso");
      } catch {
        // ignore
      }

      if (!ssoToken) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const { ok, data } = await consumeSsoToken(ssoToken);
        if (ok && data?.success && data?.session?.token) {
          await setSessionFromToken(data.session.token);
          navigate("/home", { replace: true });
          return;
        }
      } catch {
        // silently fall through
      }
      navigate("/login", { replace: true });
    })();
  }, [navigate, setSessionFromToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <img src={logoAmpara} alt="" className="w-12 h-12 opacity-80" aria-hidden="true" />
        <div
          className="w-6 h-6 rounded-full border-2 border-muted border-t-foreground animate-spin"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
