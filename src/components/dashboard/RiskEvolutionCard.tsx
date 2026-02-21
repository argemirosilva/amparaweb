import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, AlertTriangle, Shield, ShieldCheck, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";
import { callWebApi } from "@/services/webApiService";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis, XAxis } from "recharts";
import RelatorioSaudeContent, { type RelatorioSaude } from "./RelatorioSaudeContent";
import { computeEmotionalScore } from "./EmotionalFaceIcon";
import { useAuth } from "@/contexts/AuthContext";

type WindowDays = 7 | 15 | 30;

interface Assessment {
  risk_score: number;
  risk_level: string;
  trend: string;
  trend_percentage: number | null;
  fatores: string[] | null;
  resumo_tecnico: string | null;
  period_start: string;
  period_end: string;
}

const levelConfig: Record<string, { color: string; icon: typeof Shield; className: string }> = {
  "Sem Risco": { color: "hsl(142, 71%, 45%)", icon: ShieldCheck, className: "bg-green-100 text-green-700 border-green-200" },
  "Baixo": { color: "hsl(142, 71%, 45%)", icon: ShieldCheck, className: "bg-green-100 text-green-700 border-green-200" },
  "Moderado": { color: "hsl(45, 93%, 47%)", icon: Shield, className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  "Alto": { color: "hsl(25, 95%, 53%)", icon: AlertTriangle, className: "bg-orange-100 text-orange-700 border-orange-200" },
  "Crítico": { color: "hsl(0, 84%, 60%)", icon: ShieldAlert, className: "bg-red-100 text-red-700 border-red-200" },
};

const trendIcons = {
  "Subindo": TrendingUp,
  "Estável": Minus,
  "Reduzindo": TrendingDown,
};

interface HistoryPoint {
  date: string;
  score: number;
  level: string;
}


// Module-level cache so report survives re-renders and re-mounts within the same session
let cachedRelatorio: RelatorioSaude | null = null;

export default function RiskEvolutionCard() {
  const { sessionToken, usuario } = useAuth();
  const [window, setWindow] = useState<WindowDays>(7);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioSaude | null>(cachedRelatorio);
  const [relatorioLoading, setRelatorioLoading] = useState(false);
  const [relatorioError, setRelatorioError] = useState<string | null>(null);
  const [emotionalScore, setEmotionalScore] = useState<number | null>(() =>
    cachedRelatorio ? computeEmotionalScore(cachedRelatorio.sentimentos, cachedRelatorio.periodo.total_alertas) : null
  );
  

  // Fetch risk data only (no report)
  const fetchData = useCallback(async (w: WindowDays) => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const [assessRes, histRes] = await Promise.all([
        callWebApi("getRiskAssessment", sessionToken, { window_days: w }),
        callWebApi("getRiskHistory", sessionToken, { window_days: w, limit: 30 }),
      ]);
      if (assessRes.ok && assessRes.data.assessment) {
        setAssessment(assessRes.data.assessment);
      }
      if (histRes.ok && histRes.data.history) {
        setHistory(
          histRes.data.history.map((h: any) => ({
            date: h.period_end,
            score: h.risk_score,
            level: h.risk_level,
          }))
        );
      }
    } catch {
      setError("Erro ao carregar avaliação de risco");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  // Fetch report lazily on first expand, cache for entire session
  const fetchRelatorio = useCallback(async () => {
    if (cachedRelatorio || !sessionToken) return;
    setRelatorioLoading(true);
    setRelatorioError(null);
    try {
      const relRes = await callWebApi("getRelatorioSaude", sessionToken, { window_days: 90 });
      if (relRes.ok && relRes.data.relatorio) {
        const rel = relRes.data.relatorio as RelatorioSaude;
        cachedRelatorio = rel;
        setRelatorio(rel);
        setEmotionalScore(computeEmotionalScore(rel.sentimentos, rel.periodo.total_alertas));
      }
    } catch {
      setRelatorioError("Erro ao carregar relatório");
    } finally {
      setRelatorioLoading(false);
    }
  }, [sessionToken]);


  useEffect(() => {
    fetchData(window);
  }, [window, fetchData]);

  // Fetch report once on mount (cached for session)
  useEffect(() => {
    fetchRelatorio();
  }, [fetchRelatorio]);

  const handleWindowChange = (val: string) => {
    setWindow(Number(val) as WindowDays);
  };

  const level = assessment ? (levelConfig[assessment.risk_level] || levelConfig["Sem Risco"]) : levelConfig["Sem Risco"];
  const TrendIcon = assessment ? (trendIcons[assessment.trend as keyof typeof trendIcons] || Minus) : Minus;
  const LevelIcon = level.icon;

  const trendColor = assessment?.trend === "Subindo"
    ? "text-orange-500"
    : assessment?.trend === "Reduzindo"
      ? "text-green-500"
      : "text-muted-foreground";

  const trendPulse = assessment?.trend === "Subindo" || assessment?.trend === "Reduzindo"
    ? "animate-pulse"
    : "";

  return (
    <div className="ampara-card overflow-hidden !p-0">
      <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold">
              Evolução do Risco
            </p>
            <Tabs value={String(window)} onValueChange={handleWindowChange}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="text-xs px-2 h-6">7d</TabsTrigger>
                <TabsTrigger value="15" className="text-xs px-2 h-6">15d</TabsTrigger>
                <TabsTrigger value="30" className="text-xs px-2 h-6">30d</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-[100px] w-full" />
              <Skeleton className="h-3 w-48" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : assessment ? (
            <>
              {/* Score + Badge + Trend */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={level.className}>
                  {assessment.risk_level}
                </Badge>
                <div className={`flex items-center gap-1 text-sm ml-auto ${trendColor} ${trendPulse}`}>
                  <TrendIcon className="w-4 h-4" />
                  <span className="font-medium">{assessment.trend}</span>
                </div>
              </div>

              {/* Chart */}
              {history.length > 1 && (
                <div className="h-[90px] -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <defs>
                        <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={level.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={level.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <YAxis domain={[0, 100]} hide />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(v: string) => {
                          const d = new Date(v + "T00:00:00");
                          return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const p = payload[0].payload as HistoryPoint;
                          const d = new Date(p.date + "T00:00:00");
                          return (
                            <div className="bg-popover border border-border rounded-md px-2.5 py-1.5 shadow-md text-xs">
                              <p className="font-medium">{d.toLocaleDateString("pt-BR")}</p>
                              <p style={{ color: (levelConfig[p.level] || levelConfig["Sem Risco"]).color }}>
                                Score: {p.score} · {p.level}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke={level.color}
                        strokeWidth={2}
                        fill="url(#riskGrad)"
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0, fill: level.color }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Expandable report */}
              <button
                onClick={() => {
                  const next = !expanded;
                  setExpanded(next);
                  if (next) fetchRelatorio();
                }}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded ? "Ocultar relatório" : "Ver relatório de saúde da relação"}
              </button>

              {expanded && (
                <div className="pt-2 border-t border-border/50 max-h-[60vh] overflow-y-auto">
                  <RelatorioSaudeContent
                    relatorio={relatorio}
                    loading={relatorioLoading}
                    error={relatorioError}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação disponível.</p>
          )}
      </div>
    </div>
  );
}
