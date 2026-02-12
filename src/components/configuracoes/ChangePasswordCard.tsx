import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function ChangePasswordCard() {
  const { sessionToken } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const novaSenhaValida = novaSenha.length >= 6;
  const senhasConferem = novaSenha === confirmarSenha;
  const formValido = senhaAtual.length > 0 && novaSenhaValida && senhasConferem;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValido || !sessionToken) return;

    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mobile-api`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          action: "change_password",
          session_token: sessionToken,
          senha_atual: senhaAtual,
          nova_senha: novaSenha,
        }),
      });

      if (res.ok) {
        toast.success("Senha alterada com sucesso");
        setSenhaAtual("");
        setNovaSenha("");
        setConfirmarSenha("");
      } else if (res.status === 401) {
        toast.error("Senha atual incorreta");
      } else if (res.status === 429) {
        toast.error("Muitas tentativas. Aguarde 15 minutos.");
      } else {
        toast.error("Erro interno. Tente novamente.");
      }
    } catch {
      toast.error("Erro interno. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionToken) return null;

  return (
    <div className="ampara-card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <GradientIcon icon={Lock} size="sm" />
        <h3 className="font-display font-semibold text-foreground">Trocar senha</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="senha-atual">Senha atual</Label>
          <Input
            id="senha-atual"
            type="password"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nova-senha">Nova senha</Label>
          <Input
            id="nova-senha"
            type="password"
            autoComplete="new-password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            disabled={loading}
          />
          {novaSenha.length > 0 && !novaSenhaValida && (
            <p className="text-xs text-destructive">Mínimo de 6 caracteres</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
          <Input
            id="confirmar-senha"
            type="password"
            autoComplete="new-password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            disabled={loading}
          />
          {confirmarSenha.length > 0 && !senhasConferem && (
            <p className="text-xs text-destructive">As senhas não conferem</p>
          )}
        </div>

        <Button type="submit" disabled={!formValido || loading} className="w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Alterar senha
        </Button>
      </form>
    </div>
  );
}
