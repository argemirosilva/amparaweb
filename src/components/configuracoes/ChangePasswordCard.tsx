import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, ChevronDown, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function ChangePasswordCard() {
  const { sessionToken, usuario } = useAuth();
  const [open, setOpen] = useState(false);

  // Main password state
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);

  // Coercion password state
  const [cSenhaAtual, setCSenhaAtual] = useState("");
  const [cNovaSenha, setCNovaSenha] = useState("");
  const [cConfirmarSenha, setCConfirmarSenha] = useState("");
  const [cLoading, setCLoading] = useState(false);
  const [justConfigured, setJustConfigured] = useState(false);

  const hasCoercion = usuario?.has_coercion_password || justConfigured;

  // Main password validation
  const novaSenhaValida = novaSenha.length >= 6;
  const senhasConferem = novaSenha === confirmarSenha;
  const formValido = senhaAtual.length > 0 && novaSenhaValida && senhasConferem;

  // Coercion password validation
  const cNovaSenhaValida = cNovaSenha.length >= 6;
  const cSenhasConferem = cNovaSenha === cConfirmarSenha;
  const cFormValido = cSenhaAtual.length > 0 && cNovaSenhaValida && cSenhasConferem;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValido || !sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mobile-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ action: "change_password", session_token: sessionToken, senha_atual: senhaAtual, nova_senha: novaSenha }),
      });
      if (res.ok) { toast.success("Senha alterada com sucesso"); setSenhaAtual(""); setNovaSenha(""); setConfirmarSenha(""); }
      else if (res.status === 401) toast.error("Senha atual incorreta");
      else if (res.status === 429) toast.error("Muitas tentativas. Aguarde 15 minutos.");
      else toast.error("Erro interno. Tente novamente.");
    } catch { toast.error("Erro interno. Tente novamente."); }
    finally { setLoading(false); }
  };

  const handleCoercionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cFormValido || !sessionToken) return;
    setCLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mobile-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ action: "change_coercion_password", session_token: sessionToken, senha_atual: cSenhaAtual, nova_senha_coacao: cNovaSenha }),
      });
      if (res.ok) { toast.success("Senha de segurança alterada com sucesso"); setCSenhaAtual(""); setCNovaSenha(""); setCConfirmarSenha(""); setJustConfigured(true); }
      else if (res.status === 400) { const data = await res.json().catch(() => ({})); toast.error(data.error || "Dados inválidos"); }
      else if (res.status === 401) toast.error("Senha atual incorreta");
      else if (res.status === 429) toast.error("Muitas tentativas. Aguarde 15 minutos.");
      else toast.error("Erro interno. Tente novamente.");
    } catch { toast.error("Erro interno. Tente novamente."); }
    finally { setCLoading(false); }
  };

  if (!sessionToken) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 group">
        <div className="flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Configuração das senhas</h2>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm px-3 py-3 mt-1.5">
          <Tabs defaultValue="principal" className="w-full">
            <TabsList className="w-full grid grid-cols-2 h-8">
              <TabsTrigger value="principal" className="text-xs gap-1">
                <Lock className="w-3 h-3" /> Principal
              </TabsTrigger>
              <TabsTrigger value="seguranca" className="text-xs gap-1">
                <ShieldAlert className="w-3 h-3" /> Segurança
                {hasCoercion ? (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-green-500/40 text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400 ml-0.5">
                    <ShieldCheck className="w-2 h-2" />
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/40 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 ml-0.5">
                    <ShieldX className="w-2 h-2" />
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="principal" className="mt-3 animate-fade-in">
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
            </TabsContent>

            <TabsContent value="seguranca" className="mt-3 animate-fade-in">
              <p className="text-[11px] text-muted-foreground mb-2">
                A senha de segurança é usada em situações de coação. Ao usá-la para login, o sistema aparenta funcionar normalmente mas aciona silenciosamente seus guardiões.
              </p>
              <Separator className="my-2" />
              <form onSubmit={handleCoercionSubmit} className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="coacao-senha-atual" className="text-xs">Senha principal (atual)</Label>
                  <Input id="coacao-senha-atual" type="password" autoComplete="current-password" value={cSenhaAtual} onChange={(e) => setCSenhaAtual(e.target.value)} disabled={cLoading} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="coacao-nova-senha" className="text-xs">{hasCoercion ? "Nova senha de segurança" : "Criar senha de segurança"}</Label>
                  <Input id="coacao-nova-senha" type="password" autoComplete="new-password" value={cNovaSenha} onChange={(e) => setCNovaSenha(e.target.value)} disabled={cLoading} className="h-8 text-sm" />
                  {cNovaSenha.length > 0 && !cNovaSenhaValida && <p className="text-[10px] text-destructive">Mínimo de 6 caracteres</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="coacao-confirmar-senha" className="text-xs">Confirmar senha de segurança</Label>
                  <Input id="coacao-confirmar-senha" type="password" autoComplete="new-password" value={cConfirmarSenha} onChange={(e) => setCConfirmarSenha(e.target.value)} disabled={cLoading} className="h-8 text-sm" />
                  {cConfirmarSenha.length > 0 && !cSenhasConferem && <p className="text-[10px] text-destructive">As senhas não conferem</p>}
                </div>
                <Button type="submit" disabled={!cFormValido || cLoading} size="sm" className="w-full">
                  {cLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  {hasCoercion ? "Alterar senha de segurança" : "Configurar senha de segurança"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
