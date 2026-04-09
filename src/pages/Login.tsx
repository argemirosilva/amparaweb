import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import amparaLogo from "@/assets/ampara-logo-login.png";

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
    <div className="min-h-[100dvh] flex flex-col md:flex-row">
      {/* Left panel — branding (landing page style) */}
      <div
        className="hidden md:flex md:w-[45%] lg:w-[50%] relative flex-col items-center justify-center p-12 overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(280,30%,96%), hsl(320,25%,94%), hsl(280,20%,93%))" }}
      >
        {/* Organic blobs */}
        <div
          className="absolute -top-20 right-[10%] w-[500px] h-[500px] pointer-events-none opacity-[0.06]"
          style={{
            background: "radial-gradient(ellipse, hsl(320,70%,50%), transparent 70%)",
            borderRadius: "60% 40% 50% 50% / 50% 60% 40% 50%",
          }}
        />
        <div
          className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] pointer-events-none opacity-[0.05]"
          style={{
            background: "radial-gradient(ellipse, hsl(280,60%,48%), transparent 70%)",
            borderRadius: "40% 60% 55% 45% / 55% 40% 60% 45%",
          }}
        />
        <div
          className="absolute top-[20%] right-[-50px] w-[200px] h-[200px] pointer-events-none opacity-[0.04]"
          style={{
            background: "radial-gradient(ellipse, hsl(320,60%,55%), transparent 70%)",
            borderRadius: "55% 45% 50% 50% / 45% 55% 45% 55%",
          }}
        />

        {/* Halftone pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(280,60%,48%) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            opacity: 0.025,
          }}
        />

        {/* Floating ring circles */}
        <div className="absolute top-16 right-[20%] w-32 h-32 rounded-full border opacity-[0.06]" style={{ borderColor: "hsl(320,70%,50%)" }} />
        <div className="absolute bottom-20 left-[15%] w-20 h-20 rounded-full border opacity-[0.08]" style={{ borderColor: "hsl(280,60%,48%)" }} />
        <div className="absolute top-[60%] right-[5%] w-24 h-24 rounded-full border opacity-[0.05]" style={{ borderColor: "hsl(300,50%,55%)" }} />

        {/* Sparkles */}
        <div className="absolute top-12 right-[30%] w-1.5 h-1.5 rounded-full opacity-25 animate-pulse" style={{ background: "hsl(320,70%,60%)" }} />
        <div className="absolute bottom-16 right-[45%] w-1 h-1 rounded-full opacity-20 animate-pulse" style={{ background: "hsl(280,60%,55%)", animationDelay: "0.7s" }} />
        <div className="absolute top-[40%] left-[10%] w-1.5 h-1.5 rounded-full opacity-30 animate-pulse" style={{ background: "hsl(320,70%,60%)", animationDelay: "1.2s" }} />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <img src={amparaLogo} alt="AMPARA" className="w-44 h-auto object-contain mb-6" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] mb-8 text-primary/60">
            Portal da Mulher
          </p>

          <div className="space-y-4 mt-4">
            <div className="flex items-start gap-3 text-left">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Guardiões de confiança conectados a você, prontos para agir quando você precisar
              </p>
            </div>
            <div className="flex items-start gap-3 text-left">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Monitoramento inteligente com orientação e apoio em cada etapa
              </p>
            </div>
            <div className="flex items-start gap-3 text-left">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Seus dados são protegidos com criptografia e total sigilo — só você tem acesso
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, hsl(280, 25%, 96%), hsl(300, 18%, 94%), hsl(320, 15%, 92%))" }}
      >
        {/* Mobile-only decorative rings */}
        <div className="md:hidden absolute -top-16 -left-16 w-56 h-56 rounded-full border opacity-[0.08]" style={{ borderColor: "hsl(280, 60%, 50%)" }} />
        <div className="md:hidden absolute -bottom-12 -right-12 w-48 h-48 rounded-full border opacity-[0.07]" style={{ borderColor: "hsl(320, 70%, 50%)" }} />

        <div className="w-full max-w-md animate-fade-in relative z-10">
          {/* Mobile-only logo */}
          <div className="md:hidden text-center mb-8">
            <img src={amparaLogo} alt="AMPARA" className="w-32 h-auto object-contain mx-auto mb-2" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Portal da Mulher</p>
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
                <div className="absolute inset-0 rounded-xl p-[2px]" style={{ background: "linear-gradient(135deg, hsl(280, 60%, 48%), hsl(320, 70%, 50%))" }}>
                  <div className="w-full h-full rounded-[10px] bg-card/80 backdrop-blur-sm group-hover:bg-transparent transition-all duration-300" />
                </div>
                <span className="relative z-10 text-primary group-hover:text-white transition-colors duration-300">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Acessar"}
                </span>
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
    </div>
  );
}
