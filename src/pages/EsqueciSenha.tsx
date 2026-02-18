import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const emailClean = email.trim().toLowerCase();
    if (!emailClean) {
      setError("Digite seu email");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-request-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ email: emailClean, app_url: window.location.origin }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSent(true);
      } else {
        setError(data.error || "Erro ao solicitar redefinição");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  };

  if (sent) {
    return (
      <AuthLayout title="" subtitle="">
        <div className="text-center space-y-4 animate-fade-in">
          <CheckCircle className="w-16 h-16 mx-auto text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Email enviado!</h2>
          <p className="text-muted-foreground text-sm">
            Se existe uma conta com este email, você receberá um link para redefinir sua senha.
          </p>
          <Link to="/login" className="text-primary font-medium text-sm hover:underline inline-block mt-4">
            ← Voltar ao login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="" subtitle="">
      <div className="mb-6">
        <Link to="/login" className="text-muted-foreground hover:text-foreground text-sm inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar ao login
        </Link>
        <h2 className="text-xl font-semibold text-foreground">Esqueceu sua senha?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Digite seu email e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive animate-fade-in">
            {error}
          </div>
        )}

        <div>
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

        <button type="submit" disabled={loading} className="ampara-btn-primary mt-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Enviar link de redefinição"}
        </button>
      </form>
    </AuthLayout>
  );
}
