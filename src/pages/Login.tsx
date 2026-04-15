import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2, Shield } from "lucide-react";
import amparaLogo from "@/assets/ampara-logo-login.png";
import loginIllustration from "@/assets/login-illustration.png";

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
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Left panel — branding */}
      <div className="hidden md:flex md:w-[45%] lg:w-[50%] relative flex-col items-center justify-end p-12 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-ampara-magenta/5">
        {/* Subtle decorative elements */}
        <div className="absolute top-20 right-[15%] w-64 h-64 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute bottom-20 left-[10%] w-48 h-48 rounded-full bg-ampara-magenta/[0.04] blur-3xl" />

        {/* Illustration — flipped horizontally, full panel */}
        <img
          src={loginIllustration}
          alt=""
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none opacity-25"
          style={{ transform: "scaleX(-1) scale(2.5)", transformOrigin: "left bottom" }}
        />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm mb-8">
          <img src={amparaLogo} alt="AMPARA" className="w-48 h-auto object-contain mb-6" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] mb-10 text-primary/50 font-display">
            Portal da Mulher
          </p>

          <div className="space-y-5 mt-4 w-full">
            {[
              "Guardiões de confiança conectados a você, prontos para agir quando precisar",
              "Monitoramento inteligente com orientação e apoio em cada etapa",
              "Seus dados são protegidos com criptografia e total sigilo",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3 text-left">
                <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile-only logo */}
          <div className="md:hidden text-center mb-10">
            <img src={amparaLogo} alt="AMPARA" className="w-36 h-auto object-contain mx-auto mb-3" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.2em] font-display">
              Portal da Mulher
            </p>
          </div>

          {/* Card */}
          <div className="ampara-card p-6 md:p-8">
            <h2 className="text-xl font-bold text-foreground mb-1 font-display">Acesse sua conta</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Entre com seu email e senha para continuar
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {verified && (
                <div className="ampara-alert-info text-sm text-primary">
                  <Shield className="w-4 h-4 inline mr-2" />
                  Email verificado com sucesso! Faça login para continuar.
                </div>
              )}

              {error && (
                <div className="ampara-alert-danger text-sm text-destructive">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  className="ampara-input"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Senha</label>
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="ampara-btn-primary"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Acessar"}
              </button>

              <div className="flex items-center justify-between pt-1">
                <Link
                  to="/esqueci-senha"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueceu a senha?
                </Link>
                <p className="text-sm text-muted-foreground">
                  Não está cadastrada?{" "}
                  <Link to="/cadastro" className="text-primary font-semibold hover:underline">
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
