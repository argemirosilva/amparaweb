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
  MessageCircleWarning,
  Lightbulb,
  BookOpen,
} from "lucide-react";

interface MacroReport {
  id: string;
  window_days: number;
  created_at: string;
  output_json: {
    resumo?: string;
    panorama_narrativo?: string;
    orientacoes?: string[];
    principais_ofensas?: string[];
    canais_apoio?: string[];
    nivel_alerta?: string;
  };
  aggregates_json: {
    total_gravacoes_analisadas?: number;
  };
}

const ALERTA_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  baixo: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Baixo" },
  moderado: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", label: "Moderado" },
  alto: { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", label: "Alto" },
  critico: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Crítico" },
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
      if (res.data?.skipped) {
        setError("Nenhuma gravação analisada no período. Envie gravações primeiro.");
      } else {
        await fetchReport();
      }
    } else {
      setError(res.data?.error || "Erro ao gerar relatório");
    }
    setGenerating(false);
  };

  if (loading && !loaded) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando resumo...</span>
      </div>
    );
  }

  if (!report && loaded) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
          <FileBarChart className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Nenhum resumo disponível para este período.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={generateReport}
          disabled={generating}
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileBarChart className="w-3 h-3" />}
          Gerar relatório ({windowDays} dias)
        </Button>
        {error && <p className="text-xs text-destructive text-center">{error}</p>}
      </div>
    );
  }

  if (!report) return null;

  const output = report.output_json;
  const alerta = ALERTA_CONFIG[output.nivel_alerta || "baixo"] || ALERTA_CONFIG.baixo;
  const updatedAt = new Date(report.created_at);
  const isStale = Date.now() - updatedAt.getTime() > 3 * 24 * 60 * 60 * 1000;
  const panorama = output.panorama_narrativo;
  const resumo = output.resumo;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={`${alerta.bg} ${alerta.color} text-[10px] border ${alerta.border} font-medium`}>
            {alerta.label}
          </Badge>
          {isStale && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
              Desatualizado
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {updatedAt.toLocaleDateString("pt-BR")} · {report.aggregates_json.total_gravacoes_analisadas || 0} gravações
          </span>
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

      {/* Panorama */}
      {panorama && (
        <div className="rounded-lg bg-muted/30 border border-border/50 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <BookOpen className="w-3 h-3" />
            Panorama
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed">{panorama}</p>
        </div>
      )}

      {/* Resumo (if different from panorama) */}
      {resumo && resumo !== panorama && (
        <p className="text-xs text-muted-foreground italic leading-relaxed px-1">
          {resumo}
        </p>
      )}

      {/* Orientações */}
      {output.orientacoes && output.orientacoes.length > 0 && (
        <div className="rounded-lg bg-primary/[0.03] border border-primary/10 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary/70 uppercase tracking-wider">
            <Lightbulb className="w-3 h-3" />
            Orientações
          </div>
          <ul className="space-y-1.5">
            {output.orientacoes.map((o, i) => (
              <li key={i} className="text-xs text-foreground/85 leading-relaxed flex items-start gap-2">
                <span className="text-primary/50 mt-0.5 shrink-0 text-[10px]">✦</span>
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Principais ofensas */}
      {output.principais_ofensas && output.principais_ofensas.length > 0 && (
        <div className="rounded-lg bg-destructive/[0.03] border border-destructive/10 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-destructive/70 uppercase tracking-wider">
            <MessageCircleWarning className="w-3 h-3" />
            Ofensas identificadas
          </div>
          <div className="flex flex-wrap gap-1.5">
            {output.principais_ofensas.map((o, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] bg-destructive/5 text-destructive/80 border-destructive/15"
              >
                {o}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Canais de apoio */}
      {output.canais_apoio && output.canais_apoio.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {output.canais_apoio.map((c, i) => (
            <Badge key={i} variant="outline" className="text-[10px] bg-primary/5 border-primary/20">
              <Phone className="w-2.5 h-2.5 mr-1" />{c}
            </Badge>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />{error}
        </p>
      )}
    </div>
  );
}
