import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Eye, EyeOff, Loader2 } from "lucide-react";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function CadastroPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    nome_completo: "",
    telefone: "",
    email: "",
    senha: "",
    confirmar_senha: "",
    termos: false,
  });
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!form.nome_completo.trim()) return "Nome é obrigatório";
    const phoneDigits = form.telefone.replace(/\D/g, "");
    if (phoneDigits.length < 10) return "Telefone deve ter no mínimo 10 dígitos";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) return "Email inválido";
    if (form.senha.length < 6) return "Senha deve ter no mínimo 6 caracteres";
    if (form.senha !== form.confirmar_senha) return "As senhas não coincidem";
    if (!form.termos) return "Você precisa aceitar os termos";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const result = await register({
      nome_completo: form.nome_completo.trim(),
      telefone: form.telefone,
      email: form.email.trim().toLowerCase(),
      senha: form.senha,
      termos_aceitos: form.termos,
    });

    if (result.success) {
      navigate(`/validar-email?email=${encodeURIComponent(result.email!)}`);
    } else {
      setError(result.error || "Erro ao cadastrar");
    }
    setLoading(false);
  };

  return (
    <AuthLayout title="" subtitle="">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Nome completo</label>
          <input
            type="text"
            className="ampara-input"
            placeholder="Seu nome completo"
            value={form.nome_completo}
            onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Telefone</label>
          <input
            type="tel"
            className="ampara-input"
            placeholder="(00) 00000-0000"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
          <input
            type="email"
            className="ampara-input"
            placeholder="seu@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            maxLength={255}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
          <div className="relative">
            <input
              type={showSenha ? "text" : "password"}
              className="ampara-input pr-12"
              placeholder="Mínimo 6 caracteres"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
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
          <div className="relative">
            <input
              type={showConfirmar ? "text" : "password"}
              className="ampara-input pr-12"
              placeholder="Repita sua senha"
              value={form.confirmar_senha}
              onChange={(e) => setForm({ ...form, confirmar_senha: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowConfirmar(!showConfirmar)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmar ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={form.termos}
            onChange={(e) => setForm({ ...form, termos: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary accent-primary"
          />
          <span className="text-sm text-muted-foreground">
            Aceito os{" "}
            <span className="text-primary font-medium cursor-pointer hover:underline">
              termos de uso
            </span>{" "}
            e{" "}
            <Link to="/privacidade" className="text-primary font-medium hover:underline">
              política de privacidade
            </Link>
          </span>
        </label>

        <button type="submit" disabled={loading} className="ampara-btn-primary mt-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Comece a se proteger"}
        </button>

        <p className="text-center text-sm text-muted-foreground pt-2">
          Já tem uma conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
