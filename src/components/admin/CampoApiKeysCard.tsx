import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Key, Plus, Copy, Power, Trash2, Loader2 } from "lucide-react";
import { callCampoApi } from "@/services/campoService";
import { toast } from "sonner";

interface ApiKeyRow {
  id: string;
  orgao: string;
  label: string;
  key_prefix: string;
  ativo: boolean;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}

export default function CampoApiKeysCard() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [orgao, setOrgao] = useState("");
  const [label, setLabel] = useState("");

  const fetchKeys = async () => {
    setLoading(true);
    const { ok, data } = await callCampoApi("listarApiKeys");
    if (ok) setKeys(data.keys ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreate = async () => {
    if (!orgao.trim() || !label.trim()) return toast.error("Informe órgão e rótulo.");
    setCreating(true);
    const { ok, data } = await callCampoApi("criarApiKey", { orgao: orgao.trim(), label: label.trim() });
    setCreating(false);
    if (!ok) return toast.error(data?.error ?? "Falha ao criar chave.");
    setNewKey(data.api_key);
    setOrgao("");
    setLabel("");
    fetchKeys();
  };

  const handleToggle = async (key: ApiKeyRow) => {
    const { ok } = await callCampoApi("alternarApiKey", { key_id: key.id });
    if (ok) fetchKeys();
  };

  const handleDelete = async (key: ApiKeyRow) => {
    if (!confirm(`Remover chave de "${key.orgao}"? Essa ação é irreversível.`)) return;
    const { ok } = await callCampoApi("removerApiKey", { key_id: key.id });
    if (ok) {
      toast.success("Chave removida.");
      fetchKeys();
    }
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado.");
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Chaves de API (integração externa)</h2>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setNewKey(null); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nova chave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar nova chave de API</DialogTitle>
            </DialogHeader>
            {!newKey ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="orgao">Órgão / Instituição *</Label>
                  <Input id="orgao" value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Ex: SESDEC-RO, PMSP, GCM Recife" />
                </div>
                <div>
                  <Label htmlFor="label">Rótulo / Sistema *</Label>
                  <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Aplicativo COPOM, Integração SIGPM" />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Gerar chave
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                  ⚠️ Esta chave será exibida <strong>uma única vez</strong>. Copie e armazene em local seguro.
                </div>
                <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">{newKey}</div>
                <div className="flex gap-2">
                  <Button onClick={() => copy(newKey)} className="flex-1">
                    <Copy className="w-4 h-4 mr-2" /> Copiar
                  </Button>
                  <Button variant="outline" onClick={() => { setCreateOpen(false); setNewKey(null); }}>
                    Concluir
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando chaves...</p>}
      {!loading && keys.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma chave de API cadastrada. Crie uma para permitir integrações externas.
        </p>
      )}

      {keys.length > 0 && (
        <div className="border rounded-md divide-y">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between p-3 gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{k.label}</span>
                  <Badge variant="outline" className="text-[10px]">{k.orgao}</Badge>
                  {!k.ativo && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {k.key_prefix}...••••••••
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Criada em {new Date(k.created_at).toLocaleDateString("pt-BR")}
                  {k.last_used_at && ` · Último uso: ${new Date(k.last_used_at).toLocaleString("pt-BR")}`}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => handleToggle(k)} title={k.ativo ? "Desativar" : "Ativar"}>
                  <Power className={`w-4 h-4 ${k.ativo ? "text-emerald-600" : "text-muted-foreground"}`} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(k)} title="Remover">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
