import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Loader2, RefreshCw } from "lucide-react";

export default function ValidarEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const { verifyEmail, resendCode } = useAuth();

  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!emailParam) navigate("/cadastro");
  }, [emailParam, navigate]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (codigo.length !== 5 || !/^\d{5}$/.test(codigo)) {
      setError("Código deve ter 5 dígitos numéricos");
      return;
    }

    setLoading(true);
    const result = await verifyEmail(emailParam, codigo);
    if (result.success) {
      navigate("/login", { state: { verified: true } });
    } else {
      setError(result.error || "Código inválido ou expirado");
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setError("");
    setSuccess("");
    setResending(true);
    const result = await resendCode(emailParam);
    if (result.success) {
      setSuccess("Novo código enviado! Verifique seu email.");
      setCodigo("");
    } else {
      setError(result.error || "Erro ao reenviar código");
    }
    setResending(false);
  };

  return (
    <AuthLayout title="Verificar email" subtitle="Digite o código de 5 dígitos enviado para seu email">
      <div className="rounded-xl bg-secondary p-3 mb-6">
        <p className="text-sm text-secondary-foreground text-center font-medium">{emailParam}</p>
      </div>

      <form onSubmit={handleVerify} className="space-y-5">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl bg-accent border border-border p-3 text-sm text-accent-foreground">
            {success}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Código de verificação</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            className="ampara-input text-center text-2xl tracking-[0.5em] font-bold"
            placeholder="00000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 5))}
            autoFocus
          />
        </div>

        <button type="submit" disabled={loading} className="ampara-btn-primary">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Validar"}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="ampara-btn-secondary flex items-center justify-center gap-2"
        >
          {resending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Reenviar código
        </button>

        <p className="text-center text-sm text-muted-foreground pt-2">
          <Link to="/login" className="text-primary font-medium hover:underline">
            Voltar ao login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
