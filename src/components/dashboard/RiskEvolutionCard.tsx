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

// Brand colors for chart
const CHART_STROKE = "hsl(270, 60%, 42%)";
const CHART_ACCENT = "hsl(316, 72%, 48%)";

const levelConfig: Record<string, { icon: typeof Shield; className: string }> = {
  "Sem Risco": { icon: ShieldCheck, className: "bg-green-100 text-green-700 border-green-200" },
  "Baixo": { icon: ShieldCheck, className: "bg-green-100 text-green-700 border-green-200" },
  "Moderado": { icon: Shield, className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  "Alto": { icon: AlertTriangle, className: "bg-orange-100 text-orange-700 border-orange-200" },
  "Crítico": { icon: ShieldAlert, className: "bg-red-100 text-red-700 border-red-200" },
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


// Module-level cache so report survives re-renders within the same session
let cachedRelatorio: RelatorioSaude | null = null;
let cachedForUser: string | null = null;

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

  // Reset cache when user changes (logout/login)
  useEffect(() => {
    const uid = usuario?.id || null;
    if (cachedForUser && cachedForUser !== uid) {
      cachedRelatorio = null;
      cachedForUser = null;
      setRelatorio(null);
      setEmotionalScore(null);
    }
  }, [usuario?.id]);

  // Fetch report lazily, cache for entire session
  const fetchRelatorio = useCallback(async () => {
    if (cachedRelatorio && cachedForUser === usuario?.id) return;
    if (!sessionToken) return;
    setRelatorioLoading(true);
    setRelatorioError(null);
    try {
      const relRes = await callWebApi("getRelatorioSaude", sessionToken, { window_days: 90 });
      if (relRes.ok && relRes.data.relatorio) {
        const rel = relRes.data.relatorio as RelatorioSaude;
        cachedRelatorio = rel;
        cachedForUser = usuario?.id || null;
        setRelatorio(rel);
        setEmotionalScore(computeEmotionalScore(rel.sentimentos, rel.periodo.total_alertas));
      }
    } catch {
      setRelatorioError("Erro ao carregar relatório");
    } finally {
      setRelatorioLoading(false);
    }
  }, [sessionToken, usuario?.id]);


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
    ? "text-destructive"
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
            <p className="text-sm font-semibold">
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
                <div className={`flex items-center ml-auto ${trendColor} ${trendPulse}`}>
                  <TrendIcon className="w-4 h-4" />
                </div>
              </div>

              {/* Chart */}
              {history.length > 1 && (
                <div className="h-[60px] -mx-1 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 2, right: 0, bottom: 0, left: -24 }}>
                      <defs>
                        <linearGradient id="riskFillGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_STROKE} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={CHART_ACCENT} stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="riskStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={CHART_ACCENT} />
                          <stop offset="100%" stopColor={CHART_STROKE} />
                        </linearGradient>
                      </defs>
                      <YAxis domain={[20, 300]} hide />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const p = payload[0].payload as HistoryPoint;
                          const d = new Date(p.date + "T00:00:00");
                          return (
                            <div className="bg-popover/95 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-lg text-xs">
                              <p className="font-medium">{d.toLocaleDateString("pt-BR")}</p>
                              <p style={{ color: CHART_STROKE }}>
                                Score: {p.score} · {p.level}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="natural"
                        dataKey="score"
                        stroke="url(#riskStrokeGrad)"
                        strokeWidth={1.5}
                        fill="url(#riskFillGrad)"
                        dot={false}
                        activeDot={{ r: 3.5, strokeWidth: 0, fill: CHART_STROKE, filter: "drop-shadow(0 0 3px hsl(270 60% 42% / 0.4))" }}
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
                <div className="pt-2 border-t border-border/50">
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
