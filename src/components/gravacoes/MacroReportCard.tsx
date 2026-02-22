import { useState, useEffect, useCallback } from "react";
import { callWebApi } from "@/services/webApiService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileBarChart,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Shield,
  Phone,
} from "lucide-react";

interface MacroReport {
  id: string;
  window_days: number;
  created_at: string;
  output_json: {
    resumo?: string;
    panorama_narrativo?: string;
    orientacoes?: string[];
    canais_apoio?: string[];
    nivel_alerta?: string;
  };
  aggregates_json: {
    total_gravacoes_analisadas?: number;
  };
}

const ALERTA_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  baixo: { color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Baixo" },
  moderado: { color: "text-amber-600", bg: "bg-amber-500/10", label: "Moderado" },
  alto: { color: "text-orange-600", bg: "bg-orange-500/10", label: "Alto" },
  critico: { color: "text-red-600", bg: "bg-red-500/10", label: "Crítico" },
};

export default function MacroReportCard({
  sessionToken,
  windowDays = 7,
  onActiveChange,
}: {
  sessionToken: string;
  windowDays?: number;
  onActiveChange?: (active: boolean) => void;
}) {
  const [report, setReport] = useState<MacroReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await callWebApi("getMacroLatest", sessionToken, { window_days: windowDays });
    if (res.ok && res.data.report) {
      setReport(res.data.report);
      onActiveChange?.(true);
    }
    setLoaded(true);
    setLoading(false);
  }, [sessionToken, windowDays, onActiveChange]);

  useEffect(() => {
    setReport(null);
    setLoaded(false);
    fetchReport();
  }, [fetchReport]);

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    onActiveChange?.(true);
    const res = await callWebApi("runMacro", sessionToken, { window_days: windowDays });
    if (res.ok) {
      await fetchReport();
    } else {
      setError(res.data?.error || "Erro ao gerar relatório");
    }
    setGenerating(false);
  };

  if (loading && !loaded) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando resumo...</span>
      </div>
    );
  }

  if (!report && loaded) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 flex flex-col items-center gap-2">
        <FileBarChart className="w-5 h-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center">
          Nenhum resumo disponível ainda.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={generateReport}
          disabled={generating}
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileBarChart className="w-3 h-3" />}
          Gerar relatório (últimos {windowDays} dias)
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (!report) return null;

  const output = report.output_json;
  const alerta = ALERTA_CONFIG[output.nivel_alerta || "baixo"] || ALERTA_CONFIG.baixo;
  const updatedAt = new Date(report.created_at);
  const isStale = Date.now() - updatedAt.getTime() > 3 * 24 * 60 * 60 * 1000;
  const resumoText = output.resumo || output.panorama_narrativo;

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className={`w-8 h-8 rounded-lg ${alerta.bg} flex items-center justify-center shrink-0`}>
          <Shield className={`w-4 h-4 ${alerta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${alerta.bg} ${alerta.color} text-[10px] border-0`}>
              {alerta.label}
            </Badge>
            {isStale && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                Desatualizado
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {updatedAt.toLocaleDateString("pt-BR")} · {report.aggregates_json.total_gravacoes_analisadas || 0} gravações
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={generateReport}
          disabled={generating}
          title="Atualizar relatório"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Resumo */}
      {resumoText && (
        <div className="px-3 pb-2">
          <p className="text-xs text-foreground/90 leading-relaxed">{resumoText}</p>
        </div>
      )}

      {/* Orientações */}
      {output.orientacoes && output.orientacoes.length > 0 && (
        <div className="px-3 pb-2">
          <ul className="space-y-1">
            {output.orientacoes.map((o, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5 shrink-0">•</span>{o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Canais de apoio - só se alto/crítico */}
      {output.canais_apoio && output.canais_apoio.length > 0 && (
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {output.canais_apoio.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[10px] bg-primary/5">
                <Phone className="w-2.5 h-2.5 mr-1" />{c}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 pb-2">
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />{error}
          </p>
        </div>
      )}
    </div>
  );
}
