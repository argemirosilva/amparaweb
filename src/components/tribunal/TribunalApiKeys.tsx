import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Key, Plus, Copy, Power, Scale, Shield, Plug, Check, ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type TipoSistema = "judicial" | "forca_seguranca" | "outro";

const TIPO_LABEL: Record<TipoSistema, string> = {
  judicial: "Sistema Judicial",
  forca_seguranca: "Força de Segurança",
  outro: "Outra Integração",
};

const TIPO_ICON: Record<TipoSistema, typeof Scale> = {
  judicial: Scale,
  forca_seguranca: Shield,
  outro: Plug,
};

export default function TribunalApiKeys() {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const [formTipo, setFormTipo] = useState<TipoSistema>("judicial");
  const [formTenant, setFormTenant] = useState("");
  const [formOrgao, setFormOrgao] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [tenantPopoverOpen, setTenantPopoverOpen] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "listApiKeys", session_token: sessionToken },
      });
      setKeys(data?.keys || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchTenants = async () => {
    const { data } = await supabase.from("tenants").select("id, nome, sigla").eq("ativo", true);
    setTenants(data || []);
  };

  useEffect(() => { fetchKeys(); fetchTenants(); }, []);

  const resetForm = () => {
    setFormTipo("judicial");
    setFormTenant("");
    setFormOrgao("");
    setFormLabel("");
  };

  const handleCreate = async () => {
    if (!formLabel) return;
    if (formTipo === "judicial" && !formTenant) {
      toast({ title: "Selecione a entidade judicial", variant: "destructive" });
      return;
    }
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: {
          action: "createApiKey",
          session_token: sessionToken,
          tipo_sistema: formTipo,
          tenant_id: formTipo === "judicial" ? formTenant : null,
          orgao: formOrgao || null,
          label: formLabel,
        },
      });
      if (!data?.success) throw new Error(data?.error);
      setNewKey(data.api_key);
      toast({ title: "API Key criada", description: "Copie a chave agora - ela não será exibida novamente." });
      fetchKeys();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = async (keyId: string) => {
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "toggleApiKey", session_token: sessionToken, key_id: keyId },
      });
      if (!data?.success) throw new Error(data?.error);
      toast({ title: data.ativo ? "Chave ativada" : "Chave desativada" });
      fetchKeys();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{keys.length} chaves cadastradas</p>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setNewKey(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Nova API Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar API Key de Integração</DialogTitle></DialogHeader>
            {newKey ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-600 font-medium">⚠️ Copie esta chave agora. Ela não será exibida novamente.</p>
                <div className="flex items-center gap-2">
                  <Input value={newKey} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(newKey)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setCreateOpen(false); setNewKey(null); resetForm(); }}>
                  Fechar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Tipo de sistema</Label>
                  <Select value={formTipo} onValueChange={(v) => setFormTipo(v as TipoSistema)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="judicial">⚖️ Sistema Judicial (tribunais, varas, MP)</SelectItem>
                      <SelectItem value="forca_seguranca">🛡️ Força de Segurança (PM, PC, GCM, COPOM)</SelectItem>
                      <SelectItem value="outro">🔌 Outra Integração</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formTipo === "judicial" ? (
                  <div>
                    <Label className="text-xs">Entidade judicial</Label>
                    <Select value={formTenant} onValueChange={setFormTenant}>
                      <SelectTrigger><SelectValue placeholder="Selecione a entidade" /></SelectTrigger>
                      <SelectContent>
                        {tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.sigla} - {t.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs">Órgão / Instituição</Label>
                    <Input
                      value={formOrgao}
                      onChange={(e) => setFormOrgao(e.target.value)}
                      placeholder="Ex: PMSP, PCRJ, GCM Recife, COPOM-DF"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs">Rótulo / Sistema</Label>
                  <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Ex: Integração Produção" />
                </div>

                <Button
                  onClick={handleCreate}
                  disabled={!formLabel || (formTipo === "judicial" && !formTenant)}
                  className="w-full"
                >
                  Gerar Chave
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 && !loading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma API key cadastrada</CardContent></Card>
      )}

      <div className="space-y-2">
        {keys.map((k) => {
          const tipo = (k.tipo_sistema || "judicial") as TipoSistema;
          const TipoIcon = TIPO_ICON[tipo];
          const origem = tipo === "judicial"
            ? (k.tenants?.sigla || "—")
            : (k.orgao || "—");
          return (
            <Card key={k.id}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <TipoIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{k.label}</span>
                    <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[tipo]}</Badge>
                    <Badge variant={k.ativo ? "default" : "secondary"} className="text-xs">
                      {k.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {k.key_prefix}... | {origem} | Criada: {new Date(k.created_at).toLocaleDateString("pt-BR")}
                    {k.expires_at && ` | Expira: ${new Date(k.expires_at).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleToggle(k.id)} title={k.ativo ? "Desativar" : "Ativar"}>
                  <Power className={`w-4 h-4 ${k.ativo ? "text-green-600" : "text-muted-foreground"}`} />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
