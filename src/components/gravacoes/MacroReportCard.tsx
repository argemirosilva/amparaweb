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
  Heart,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface MacroReport {
  id: string;
  window_days: number;
  created_at: string;
  output_json: {
    panorama_narrativo?: string;
    explicacao_emocional?: string;
    orientacoes?: string[];
    canais_apoio?: string[];
    ciclo_violencia_resumo?: string;
    nivel_alerta?: string;
  };
  aggregates_json: {
    total_gravacoes_analisadas?: number;
    alertas_panico?: number;
    niveis_risco_gravacoes?: Record<string, number>;
    distribuicao_fases_ciclo?: Record<string, number>;
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
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className={`w-10 h-10 rounded-xl ${alerta.bg} flex items-center justify-center shrink-0`}>
          <Shield className={`w-5 h-5 ${alerta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              Resumo dos últimos {report.window_days} dias
            </span>
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
            Atualizado em {updatedAt.toLocaleDateString("pt-BR")} às {updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {" · "}{report.aggregates_json.total_gravacoes_analisadas || 0} gravações analisadas
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={generateReport}
            disabled={generating}
            title="Atualizar relatório"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-8 w-8 p-0"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Panorama always visible */}
      {output.panorama_narrativo && (
        <div className="px-3 pb-2">
          <p className="text-xs text-foreground/90 leading-relaxed line-clamp-3">
            {output.panorama_narrativo}
          </p>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
          {/* Emotional explanation */}
          {output.explicacao_emocional && (
            <Section icon={Heart} title="Análise Emocional">
              <p className="text-xs text-foreground leading-relaxed">{output.explicacao_emocional}</p>
            </Section>
          )}

          {/* Cycle summary */}
          {output.ciclo_violencia_resumo && (
            <Section icon={TrendingUp} title="Ciclo de Violência">
              <p className="text-xs text-foreground leading-relaxed">{output.ciclo_violencia_resumo}</p>
            </Section>
          )}

          {/* Guidelines */}
          {output.orientacoes && output.orientacoes.length > 0 && (
            <Section icon={Heart} title="Orientações">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                <ul className="space-y-1.5">
                  {output.orientacoes.map((o, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5 shrink-0">•</span>{o}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}

          {/* Support channels */}
          {output.canais_apoio && output.canais_apoio.length > 0 && (
            <Section icon={Phone} title="Canais de Apoio">
              <div className="flex flex-wrap gap-1.5">
                {output.canais_apoio.map((c, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-primary/5">
                    <Phone className="w-2.5 h-2.5 mr-1" />{c}
                  </Badge>
                ))}
              </div>
            </Section>
          )}
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

function Section({ icon: Icon, title, children }: { icon: typeof Heart; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="w-3 h-3" />{title}
      </div>
      {children}
    </div>
  );
}
