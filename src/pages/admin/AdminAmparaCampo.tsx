import { useEffect, useState } from "react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { callCampoApi, type VitimaResultado } from "@/services/campoService";
import { Shield, FileText, Search, Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface LogRow {
  id: string;
  vitima_id: string | null;
  query_type: string;
  found: boolean;
  agente_identificacao: string | null;
  agente_orgao: string | null;
  ip_address: string | null;
  created_at: string;
}

interface OcorrenciaRow {
  id: string;
  vitima_id: string;
  situacao: string;
  comportamento_requerido: string | null;
  estado_vitima: string | null;
  contexto: string[];
  observacao: string | null;
  agente_identificacao: string | null;
  agente_orgao: string | null;
  protocolo_externo: string | null;
  nivel_risco_snapshot: string | null;
  tags_snapshot: string[];
  created_at: string;
}

const RISK_COLORS: Record<string, string> = {
  baixo: "bg-emerald-100 text-emerald-800",
  moderado: "bg-amber-100 text-amber-800",
  alto: "bg-orange-100 text-orange-800",
  critico: "bg-red-100 text-red-800",
};

export default function AdminAmparaCampo() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca de vítima
  const [agente, setAgente] = useState(() => localStorage.getItem("campo_agente") ?? "");
  const [orgao, setOrgao] = useState(() => localStorage.getItem("campo_orgao") ?? "");
  const [query, setQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<VitimaResultado[] | null>(null);

  useEffect(() => {
    (async () => {
      const { ok, data } = await callCampoApi("listarAuditoria", { limit: 200 });
      if (ok) {
        setLogs(data.logs ?? []);
        setOcorrencias(data.ocorrencias ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const handleBuscar = async () => {
    if (!agente.trim()) return toast.error("Informe sua identificação (matrícula).");
    if (query.trim().length < 3) return toast.error("Termo de busca muito curto.");
    localStorage.setItem("campo_agente", agente.trim());
    localStorage.setItem("campo_orgao", orgao.trim());
    setBuscando(true);
    setResultados(null);
    const { ok, data } = await callCampoApi("buscarVitima", {
      query: query.trim(),
      agente_identificacao: agente.trim(),
      agente_orgao: orgao.trim(),
    });
    setBuscando(false);
    if (!ok) return toast.error(data?.error ?? "Falha na consulta.");
    setResultados(data.resultados ?? []);
    if ((data.resultados ?? []).length === 0) {
      toast.info("Nenhum registro encontrado.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        breadcrumb="Forças de Segurança"
        title="AMPARA Campo"
        description="Auditoria de consultas e ocorrências registradas em campo por agentes públicos."
        icon={Shield}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Consultas totais</p>
          <p className="text-3xl font-bold mt-1">{logs.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Ocorrências registradas</p>
          <p className="text-3xl font-bold mt-1">{ocorrencias.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Risco alto/crítico</p>
          <p className="text-3xl font-bold mt-1 text-red-700">
            {ocorrencias.filter((o) => o.nivel_risco_snapshot === "alto" || o.nivel_risco_snapshot === "critico").length}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="ocorrencias">
        <TabsList>
          <TabsTrigger value="ocorrencias"><FileText className="w-4 h-4 mr-2" /> Ocorrências</TabsTrigger>
          <TabsTrigger value="logs"><Search className="w-4 h-4 mr-2" /> Logs de acesso</TabsTrigger>
        </TabsList>

        <TabsContent value="ocorrencias" className="space-y-3 mt-4">
          {loading && <Skeleton className="h-40 w-full" />}
          {!loading && ocorrencias.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma ocorrência registrada ainda.</Card>
          )}
          {ocorrencias.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {o.nivel_risco_snapshot && (
                      <Badge className={RISK_COLORS[o.nivel_risco_snapshot] ?? ""}>
                        {o.nivel_risco_snapshot.toUpperCase()}
                      </Badge>
                    )}
                    <span className="font-medium text-sm">{o.situacao.replace(/_/g, " ")}</span>
                    {o.protocolo_externo && (
                      <Badge variant="outline" className="text-xs">{o.protocolo_externo}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Agente: {o.agente_identificacao ?? "—"} {o.agente_orgao && `(${o.agente_orgao})`} ·{" "}
                    {new Date(o.created_at).toLocaleString("pt-BR")}
                  </p>
                  {o.observacao && <p className="text-sm mt-2 italic">"{o.observacao}"</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {o.tags_snapshot.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Vítima: {o.vitima_id.slice(0, 8)}…</p>
                  {o.estado_vitima && <p>{o.estado_vitima.replace(/_/g, " ")}</p>}
                  {o.comportamento_requerido && <p>{o.comportamento_requerido.replace(/_/g, " ")}</p>}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          {loading && <Skeleton className="h-40 w-full" />}
          {!loading && (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Agente</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Resultado</th>
                    <th className="text-left p-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                      <td className="p-3 text-xs">
                        {l.agente_identificacao ?? "—"} {l.agente_orgao && <span className="text-muted-foreground">({l.agente_orgao})</span>}
                      </td>
                      <td className="p-3 text-xs">{l.query_type}</td>
                      <td className="p-3 text-xs">
                        <Badge variant={l.found ? "default" : "outline"} className="text-[10px]">
                          {l.found ? "Encontrou" : "Sem resultado"}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{l.ip_address ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
