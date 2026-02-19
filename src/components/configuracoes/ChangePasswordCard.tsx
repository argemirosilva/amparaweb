import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function ChangePasswordCard() {
  const { sessionToken } = useAuth();
  const [open, setOpen] = useState(false);
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
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 group">
        <div className="flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Trocar senha</h2>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm px-3 py-2 mt-1.5">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="senha-atual" className="text-xs">Senha atual</Label>
              <Input id="senha-atual" type="password" autoComplete="current-password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} disabled={loading} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nova-senha" className="text-xs">Nova senha</Label>
              <Input id="nova-senha" type="password" autoComplete="new-password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} disabled={loading} className="h-8 text-sm" />
              {novaSenha.length > 0 && !novaSenhaValida && <p className="text-[10px] text-destructive">Mínimo de 6 caracteres</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmar-senha" className="text-xs">Confirmar nova senha</Label>
              <Input id="confirmar-senha" type="password" autoComplete="new-password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} disabled={loading} className="h-8 text-sm" />
              {confirmarSenha.length > 0 && !senhasConferem && <p className="text-[10px] text-destructive">As senhas não conferem</p>}
            </div>
            <Button type="submit" disabled={!formValido || loading} size="sm" className="w-full">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Alterar senha
            </Button>
          </form>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
