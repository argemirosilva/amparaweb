import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, AlertTriangle, Shield, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis, XAxis } from "recharts";

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

export default function RiskEvolutionCard() {
  const { sessionToken } = useAuth();
  const [window, setWindow] = useState<WindowDays>(7);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

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

  useEffect(() => {
    fetchData(window);
  }, [window, fetchData]);

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
    <div className="ampara-card">
      <div className="pb-3">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold flex items-center gap-2">
            <GradientIcon icon={LevelIcon} size="sm" />
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
      </div>
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[140px] w-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : assessment ? (
          <>
            {/* Score + Level + Trend */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-3xl font-bold" style={{ color: level.color }}>
                {assessment.risk_score}
              </span>
              <Badge className={level.className}>
                {assessment.risk_level}
              </Badge>
              <div className={`flex items-center gap-1 text-sm ml-auto ${trendColor} ${trendPulse}`}>
                <TrendIcon className="w-4 h-4" />
                <span className="font-medium">{assessment.trend}</span>
              </div>
            </div>

            {/* Gráfico de evolução */}
            {history.length > 1 && (
              <div className="h-[120px] -mx-2">
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

            {/* Detalhes expansíveis */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? "Ocultar detalhes" : "Ver detalhes da análise"}
            </button>

            {expanded && (
              <div className="space-y-3 pt-1 border-t border-border/50">
                {/* Fatores */}
                {assessment.fatores && assessment.fatores.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Fatores identificados</span>
                    <ul className="mt-1.5 space-y-1">
                      {(assessment.fatores as string[]).map((f, i) => (
                        <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: level.color }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resumo */}
                {assessment.resumo_tecnico && (
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Resumo técnico</span>
                    <p className="mt-1 text-xs text-foreground/70 leading-relaxed">
                      {assessment.resumo_tecnico}
                    </p>
                  </div>
                )}

                {/* Período */}
                <p className="text-[10px] text-muted-foreground/60">
                  Período: {assessment.period_start} a {assessment.period_end}
                </p>
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
