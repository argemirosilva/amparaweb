import { useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function ConfigurarConta() {
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get("token") || "";
  const email = params.get("email") || "";
  const isResetPath = location.pathname === "/redefinir-senha";
  const tipo = params.get("tipo") || (isResetPath ? "reset" : "convite");

  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isReset = tipo === "reset";
  const title = isReset ? "Redefinir Senha" : "Configurar Conta";
  const subtitle = isReset
    ? "Crie uma nova senha para acessar sua conta."
    : "Bem-vindo(a) ao AMPARA! Crie sua senha para acessar o sistema.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (senha.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (senha !== confirmar) {
      setError("As senhas não coincidem");
      return;
    }
    if (!token || !email) {
      setError("Link inválido. Solicite um novo convite.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-setup-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ email, token, nova_senha: senha, tipo: isReset ? "reset" : "convite" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "Erro ao configurar senha");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <AuthLayout title="" subtitle="">
        <div className="text-center space-y-4 animate-fade-in">
          <CheckCircle className="w-16 h-16 mx-auto text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            {isReset ? "Senha redefinida!" : "Conta configurada!"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isReset
              ? "Sua senha foi redefinida com sucesso."
              : "Sua conta foi ativada com sucesso."}
          </p>
          <Link
            to="/login"
            className="ampara-btn-primary inline-block mt-4"
          >
            Fazer login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="" subtitle="">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        {email && (
          <p className="text-xs text-muted-foreground mt-2">
            Email: <span className="font-medium text-foreground">{email}</span>
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Nova senha</label>
          <div className="relative">
            <input
              type={showSenha ? "text" : "password"}
              className="ampara-input pr-12"
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              maxLength={128}
            />
            <button
              type="button"
              onClick={() => setShowSenha(!showSenha)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Confirmar senha</label>
          <input
            type={showSenha ? "text" : "password"}
            className="ampara-input"
            placeholder="Repita a senha"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            maxLength={128}
          />
        </div>

        <button type="submit" disabled={loading} className="ampara-btn-primary mt-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : isReset ? "Redefinir senha" : "Criar senha e ativar conta"}
        </button>
      </form>
    </AuthLayout>
  );
}
