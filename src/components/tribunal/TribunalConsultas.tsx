import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Eye, FileJson, FileText, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const MODO_LABELS: Record<string, string> = {
  analitico: "Analítico",
  despacho: "Despacho",
  parecer: "Parecer Técnico",
};

const MODO_ICONS: Record<string, any> = {
  analitico: FileJson,
  despacho: FileText,
  parecer: BookOpen,
};

export default function TribunalConsultas() {
  const { sessionToken } = useAuth();
  const [consultas, setConsultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroModo, setFiltroModo] = useState<string>("todos");
  const [selected, setSelected] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchConsultas = async () => {
    setLoading(true);
    try {
      const body: any = { action: "listConsultas", session_token: sessionToken, limit: 50 };
      if (filtroModo !== "todos") body.modo_saida = filtroModo;

      const { data } = await supabase.functions.invoke("tribunal-api", { body });
      setConsultas(data?.consultas || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchDetail = async (id: string) => {
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "getConsulta", session_token: sessionToken, consulta_id: id },
      });
      setSelected(data?.consulta || null);
      setDetailOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchConsultas(); }, [filtroModo]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filtroModo} onValueChange={setFiltroModo}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="Filtrar modo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os modos</SelectItem>
            <SelectItem value="analitico">Analítico</SelectItem>
            <SelectItem value="despacho">Despacho</SelectItem>
            <SelectItem value="parecer">Parecer Técnico</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchConsultas} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{consultas.length} consultas</span>
      </div>

      {consultas.length === 0 && !loading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma consulta encontrada</CardContent></Card>
      )}

      <div className="space-y-2">
        {consultas.map((c) => {
          const Icon = MODO_ICONS[c.modo_saida] || FileText;
          return (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => fetchDetail(c.id)}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === "success" ? "default" : "destructive"} className="text-xs">
                      {MODO_LABELS[c.modo_saida] || c.modo_saida}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    ID: {c.id.substring(0, 8)}... | Modelo: {c.model || "—"} | Prompt: {c.prompt_version || "—"}
                  </p>
                </div>
                <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Detalhe da Consulta</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            {selected && (
              <div className="space-y-4 pr-4">
                <div className="flex gap-2 flex-wrap">
                  <Badge>{MODO_LABELS[selected.modo_saida]}</Badge>
                  <Badge variant={selected.status === "success" ? "outline" : "destructive"}>{selected.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(selected.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>

                {selected.modo_saida === "analitico" && selected.output_json && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Saída Analítica (JSON)</CardTitle></CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap">
                        {JSON.stringify(selected.output_json, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {selected.modo_saida !== "analitico" && selected.output_text && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Saída {MODO_LABELS[selected.modo_saida]}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                        {selected.output_text}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selected.error_message && (
                  <Card className="border-destructive">
                    <CardContent className="py-3 text-sm text-destructive">{selected.error_message}</CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader><CardTitle className="text-sm">Objeto de Análise Intermediário</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64 whitespace-pre-wrap">
                      {JSON.stringify(selected.analysis_object, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
