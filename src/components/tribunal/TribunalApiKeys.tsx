import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Key, Plus, Copy, Power } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function TribunalApiKeys() {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const [formTenant, setFormTenant] = useState("");
  const [formLabel, setFormLabel] = useState("");

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

  const handleCreate = async () => {
    if (!formTenant || !formLabel) return;
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "createApiKey", session_token: sessionToken, tenant_id: formTenant, label: formLabel },
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
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setNewKey(null); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-2" /> Nova API Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar API Key</DialogTitle></DialogHeader>
            {newKey ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-600 font-medium">⚠️ Copie esta chave agora. Ela não será exibida novamente.</p>
                <div className="flex items-center gap-2">
                  <Input value={newKey} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(newKey)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setCreateOpen(false); setNewKey(null); }}>
                  Fechar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Entidade</Label>
                  <Select value={formTenant} onValueChange={setFormTenant}>
                    <SelectTrigger><SelectValue placeholder="Selecione a entidade" /></SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.sigla} - {t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Label</Label>
                  <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Ex: API Produção Tribunal SP" />
                </div>
                <Button onClick={handleCreate} disabled={!formTenant || !formLabel} className="w-full">
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
        {keys.map((k) => (
          <Card key={k.id}>
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <Key className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{k.label}</span>
                  <Badge variant={k.ativo ? "default" : "secondary"} className="text-xs">
                    {k.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {k.key_prefix}... | {k.tenants?.sigla || "—"} | Criada: {new Date(k.created_at).toLocaleDateString("pt-BR")}
                  {k.expires_at && ` | Expira: ${new Date(k.expires_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleToggle(k.id)} title={k.ativo ? "Desativar" : "Ativar"}>
                <Power className={`w-4 h-4 ${k.ativo ? "text-green-600" : "text-muted-foreground"}`} />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
