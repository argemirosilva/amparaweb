import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, CheckCircle, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const TIPOS = [
  { value: "base", label: "Prompt Base", desc: "Comum a todos os modos" },
  { value: "analitico", label: "Analítico", desc: "Saída JSON estruturada" },
  { value: "despacho", label: "Despacho", desc: "Texto institucional" },
  { value: "parecer", label: "Parecer Técnico", desc: "Parecer analítico" },
];

export default function TribunalPrompts() {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState("base");
  const [editContent, setEditContent] = useState("");

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "listPrompts", session_token: sessionToken },
      });
      setPrompts(data?.prompts || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchPrompts(); }, []);

  useEffect(() => {
    const active = prompts.find((p) => p.tipo === selectedTipo && p.ativo);
    setEditContent(active?.conteudo || "");
  }, [selectedTipo, prompts]);

  const activePrompt = prompts.find((p) => p.tipo === selectedTipo && p.ativo);
  const allVersions = prompts.filter((p) => p.tipo === selectedTipo).sort((a, b) => b.versao - a.versao);

  const handleSave = async () => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "savePrompt", session_token: sessionToken, tipo: selectedTipo, conteudo: editContent.trim() },
      });
      if (!data?.success) throw new Error(data?.error);
      toast({ title: "Prompt salvo", description: `${selectedTipo} v${data.prompt.versao} ativado` });
      fetchPrompts();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleActivate = async (id: string) => {
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "activatePrompt", session_token: sessionToken, prompt_id: id },
      });
      if (!data?.success) throw new Error(data?.error);
      toast({ title: "Prompt ativado" });
      fetchPrompts();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selectedTipo} onValueChange={setSelectedTipo}>
          <SelectTrigger className="w-56 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label} - {t.desc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activePrompt && (
          <Badge variant="outline" className="text-xs">
            Versão ativa: v{activePrompt.versao}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Editor - {TIPOS.find((t) => t.value === selectedTipo)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={16}
            className="font-mono text-xs"
            placeholder="Conteúdo do prompt..."
          />
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving || !editContent.trim()}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar nova versão
            </Button>
            <span className="text-xs text-muted-foreground">
              {editContent.length} caracteres
            </span>
          </div>
        </CardContent>
      </Card>

      {allVersions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4" /> Histórico de versões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allVersions.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded border text-sm"
                >
                  <Badge variant={p.ativo ? "default" : "outline"} className="text-xs">
                    v{p.versao}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex-1">
                    {new Date(p.created_at).toLocaleString("pt-BR")} - {p.conteudo.substring(0, 80)}...
                  </span>
                  {p.ativo ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleActivate(p.id)} className="text-xs">
                      Ativar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
