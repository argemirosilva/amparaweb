import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import amparaLogo from "@/assets/ampara-logo.png";

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
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src={amparaLogo} alt="AMPARA" className="w-24 h-24 mx-auto mb-2 object-contain" />
          <p className="text-xs font-semibold text-primary uppercase tracking-widest">Portal da Mulher</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-bold text-foreground mb-1">Acesse sua conta</h2>
          <p className="text-sm text-muted-foreground mb-5">Entre com seu email e senha para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {verified && (
              <div className="rounded-lg bg-accent border border-border p-3 text-sm text-accent-foreground">
                Email verificado com sucesso! Faça login para continuar.
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring/40 focus:border-primary placeholder:text-muted-foreground"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? "text" : "password"}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-12 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring/40 focus:border-primary placeholder:text-muted-foreground"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2.5 px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, hsl(280, 60%, 48%), hsl(320, 70%, 50%))" }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Acessar"}
            </button>

            <div className="flex items-center justify-between pt-2">
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
        </div>
      </div>
    </div>
  );
}
