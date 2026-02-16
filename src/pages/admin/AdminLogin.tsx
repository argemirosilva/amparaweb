import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import amparaIcon from "@/assets/ampara-icon-transparent.png";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !senha) {
      setError("Email e senha são obrigatórios");
      return;
    }

    setLoading(true);

    const result = await login(email.trim(), senha);
    if (!result.success) {
      setError(result.error || "Email ou senha incorretos");
      setLoading(false);
      return;
    }

    // Check admin role
    const token = localStorage.getItem("ampara_session_token");
    if (!token) {
      setError("Erro ao verificar sessão");
      setLoading(false);
      return;
    }

    // Fetch user to get id, then check roles
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    try {
      const sessionRes = await fetch(`${SUPABASE_URL}/functions/v1/auth-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ session_token: token }),
      });
      const sessionData = await sessionRes.json();

      if (!sessionData.valid || !sessionData.usuario?.id) {
        setError("Sessão inválida");
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionData.usuario.id);

      const hasAdmin = (roles || []).some(
        (r: any) => r.role === "admin_master" || r.role === "admin_tenant" || r.role === "operador"
      );

      if (!hasAdmin) {
        setError("Acesso restrito. Sua conta não possui permissão administrativa.");
        setLoading(false);
        return;
      }

      navigate("/admin");
    } catch {
      setError("Erro ao verificar permissões");
    }

    setLoading(false);
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4"
      style={{ background: "hsl(210 17% 96%)", ...fontStyle }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4"
            style={{ background: "hsl(224 76% 33%)" }}
          >
            <img src={amparaIcon} alt="AMPARA" className="w-10 h-10 object-contain brightness-0 invert" />
          </div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: "hsl(220 13% 18%)" }}
          >
            Painel Administrativo
          </h1>
          <p className="text-sm mt-1" style={{ color: "hsl(220 9% 46%)" }}>
            Acesso restrito a gestores e operadores
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-md border p-6"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: "1px solid hsl(220 13% 91%)" }}>
            <ShieldCheck className="w-4 h-4" style={{ color: "hsl(224 76% 33%)" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(220 9% 46%)" }}>
              Autenticação Segura
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="rounded-md border p-3 text-sm"
                style={{
                  background: "hsl(0 86% 97%)",
                  borderColor: "hsl(0 84% 85%)",
                  color: "hsl(0 72% 45%)",
                }}
              >
                {error}
              </div>
            )}

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "hsl(220 13% 18%)" }}
              >
                Email institucional
              </label>
              <input
                type="email"
                className="w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors"
                style={{
                  borderColor: "hsl(220 13% 87%)",
                  background: "hsl(210 17% 98%)",
                  color: "hsl(220 13% 18%)",
                }}
                placeholder="admin@orgao.gov.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "hsl(220 13% 18%)" }}
              >
                Senha
              </label>
              <div className="relative">
                <input
                  type={showSenha ? "text" : "password"}
                  className="w-full rounded-md border px-3 py-2.5 pr-12 text-sm outline-none transition-colors"
                  style={{
                    borderColor: "hsl(220 13% 87%)",
                    background: "hsl(210 17% 98%)",
                    color: "hsl(220 13% 18%)",
                  }}
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "hsl(220 9% 46%)" }}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Entrar no Painel"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "hsl(220 9% 60%)" }}>
          Sistema protegido por autenticação segura.
          <br />
          Tentativas indevidas são registradas.
        </p>
      </div>
    </div>
  );
}
