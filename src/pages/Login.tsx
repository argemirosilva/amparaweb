import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import amparaLogo from "@/assets/ampara-circle-logo.png";

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
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, hsl(280, 25%, 96%), hsl(300, 18%, 94%), hsl(320, 15%, 92%))" }}
    >
      {/* Decorative ring circles */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full border opacity-[0.08]" style={{ borderColor: "hsl(280, 60%, 50%)" }} />
      <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full border opacity-[0.06]" style={{ borderColor: "hsl(320, 70%, 55%)" }} />
      <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full border opacity-[0.07]" style={{ borderColor: "hsl(320, 70%, 50%)" }} />
      <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full border opacity-[0.05]" style={{ borderColor: "hsl(280, 55%, 52%)" }} />
      <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full border opacity-[0.04]" style={{ borderColor: "hsl(300, 50%, 55%)" }} />
      <div className="absolute bottom-1/3 left-1/5 w-20 h-20 rounded-full border opacity-[0.06]" style={{ borderColor: "hsl(280, 60%, 48%)" }} />

      {/* Small accent dots */}
      <div className="absolute top-16 right-20 w-2 h-2 rounded-full opacity-20 animate-pulse" style={{ background: "hsl(320, 70%, 60%)" }} />
      <div className="absolute bottom-24 left-16 w-1.5 h-1.5 rounded-full opacity-25 animate-pulse" style={{ background: "hsl(280, 60%, 55%)" }} />
      <div className="absolute top-1/2 right-12 w-1 h-1 rounded-full opacity-15 animate-pulse" style={{ background: "hsl(310, 65%, 55%)", animationDelay: "1s" }} />

      <div className="w-full max-w-md animate-fade-in relative z-10">
        {/* Logo with organic backdrop */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div className="absolute -inset-4 rounded-full border opacity-[0.12]" style={{ borderColor: "hsl(280, 60%, 48%)" }} />
            <div className="absolute -inset-8 rounded-full border opacity-[0.06]" style={{ borderColor: "hsl(320, 70%, 55%)" }} />
            <div className="relative w-20 h-20 rounded-full overflow-hidden ring-[3px] ring-primary/20 shadow-lg mx-auto">
              <img src={amparaLogo} alt="AMPARA" className="w-full h-full object-cover" />
            </div>
          </div>
          <h1 className="mt-4 text-xl font-display font-bold text-foreground tracking-tight">AMPARA</h1>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">Portal da Mulher</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 shadow-lg">
          <h2 className="text-lg font-bold text-foreground mb-1">Acesse sua conta</h2>
          <p className="text-sm text-muted-foreground mb-5">Entre com seu email e senha para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {verified && (
              <div className="rounded-xl bg-accent/50 border border-border p-3 text-sm text-accent-foreground">
                Email verificado com sucesso! Faça login para continuar.
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                className="w-full rounded-xl border border-input bg-background/70 px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground"
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
                  className="w-full rounded-xl border border-input bg-background/70 px-3.5 py-2.5 pr-12 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground"
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
              className="relative w-full rounded-xl py-2.5 px-4 text-sm font-semibold overflow-hidden transition-all duration-300 disabled:opacity-60 hover:shadow-lg group"
              style={{ background: "transparent" }}
            >
              {/* Gradient border */}
              <div className="absolute inset-0 rounded-xl p-[2px]" style={{ background: "linear-gradient(135deg, hsl(280, 60%, 48%), hsl(320, 70%, 50%))" }}>
                <div className="w-full h-full rounded-[10px] bg-card/80 backdrop-blur-sm group-hover:bg-transparent transition-all duration-300" />
              </div>
              <span className="relative z-10 text-primary group-hover:text-white transition-colors duration-300">
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Acessar"}
              </span>
            </button>
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
