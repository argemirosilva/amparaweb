import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function ChangeCoercionPasswordCard() {
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
          action: "change_coercion_password",
          session_token: sessionToken,
          senha_atual: senhaAtual,
          nova_senha_coacao: novaSenha,
        }),
      });

      if (res.ok) {
        toast.success("Senha de segurança alterada com sucesso");
        setSenhaAtual("");
        setNovaSenha("");
        setConfirmarSenha("");
      } else if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Dados inválidos");
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
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <ShieldAlert className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Senha de segurança</h2>
      </div>

      <Card>
        <CardContent className="px-3 py-2">
          <p className="text-[11px] text-muted-foreground mb-2">
            A senha de segurança é usada em situações de coação. Ao usá-la para login, o sistema aparenta funcionar normalmente mas aciona silenciosamente seus guardiões.
          </p>
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="coacao-senha-atual" className="text-xs">Senha principal (atual)</Label>
              <Input id="coacao-senha-atual" type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} disabled={loading} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="coacao-nova-senha" className="text-xs">Nova senha de segurança</Label>
              <Input id="coacao-nova-senha" type="password" autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} disabled={loading} className="h-8 text-sm" />
              {novaSenha.length > 0 && !novaSenhaValida && <p className="text-[10px] text-destructive">Mínimo de 6 caracteres</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="coacao-confirmar-senha" className="text-xs">Confirmar senha de segurança</Label>
              <Input id="coacao-confirmar-senha" type="password" autoComplete="new-password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} disabled={loading} className="h-8 text-sm" />
              {confirmarSenha.length > 0 && !senhasConferem && <p className="text-[10px] text-destructive">As senhas não conferem</p>}
            </div>
            <Button type="submit" disabled={!formValido || loading} size="sm" className="w-full">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Alterar senha de segurança
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
