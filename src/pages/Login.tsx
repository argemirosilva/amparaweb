import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const verified = (location.state as any)?.verified;

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
    if (result.success) {
      navigate("/home");
    } else if (result.redirect === "verify") {
      navigate(`/validar-email?email=${encodeURIComponent(result.email!)}`);
    } else {
      setError(result.error || "Email ou senha incorretos");
    }
    setLoading(false);
  };

  return (
    <AuthLayout title="" subtitle="">
      <form onSubmit={handleSubmit} className="space-y-4">
        {verified && (
          <div className="rounded-xl bg-accent border border-border p-3 text-sm text-accent-foreground opacity-0 animate-fade-in">
            Email verificado com sucesso! Faça login para continuar.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive opacity-0 animate-fade-in">
            {error}
          </div>
        )}

        <div className="opacity-0 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
          <input
            type="email"
            className="ampara-input"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
          />
        </div>

        <div className="opacity-0 animate-fade-in" style={{ animationDelay: "200ms" }}>
          <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
          <div className="relative">
            <input
              type={showSenha ? "text" : "password"}
              className="ampara-input pr-12"
              placeholder="Sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
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

        <button type="submit" disabled={loading} className="ampara-btn-primary mt-2 opacity-0 animate-fade-in" style={{ animationDelay: "300ms" }}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Acessar"}
        </button>

        <div className="flex items-center justify-between pt-2 opacity-0 animate-fade-in" style={{ animationDelay: "400ms" }}>
          <Link to="/esqueci-senha" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Esqueceu a senha?
          </Link>
          <p className="text-sm text-muted-foreground">
            Não está cadastrada?{" "}
            <Link to="/cadastro" className="text-primary font-medium hover:underline">
              Proteja-se
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
