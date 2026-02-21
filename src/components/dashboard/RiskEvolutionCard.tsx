import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, AlertTriangle, Shield, ShieldCheck, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";
import { callWebApi } from "@/services/webApiService";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis, XAxis } from "recharts";
import RelatorioSaudeContent, { type RelatorioSaude } from "./RelatorioSaudeContent";
import EmotionalFaceIcon, { computeEmotionalScore, getEmotionalLevel } from "./EmotionalFaceIcon";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

const avatarKeyMap: Record<string, string> = {
  "Radiante": "radiante",
  "Tranquila": "tranquila",
  "Cansada": "neutra",
  "Triste": "desgastada",
  "Chorando": "triste",
  "Em colapso": "em_colapso",
};

export default function RiskEvolutionCard() {
  const { sessionToken, usuario } = useAuth();
  const [window, setWindow] = useState<WindowDays>(7);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioSaude | null>(null);
  const [relatorioLoading, setRelatorioLoading] = useState(false);
  const [relatorioError, setRelatorioError] = useState<string | null>(null);
  const [emotionalScore, setEmotionalScore] = useState<number | null>(null);
  const [emotionalAvatars, setEmotionalAvatars] = useState<Record<string, string> | null>(null);

  const fetchData = useCallback(async (w: WindowDays) => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const [assessRes, histRes, relRes] = await Promise.all([
        callWebApi("getRiskAssessment", sessionToken, { window_days: w }),
        callWebApi("getRiskHistory", sessionToken, { window_days: w, limit: 30 }),
        callWebApi("getRelatorioSaude", sessionToken, { window_days: w <= 30 ? 90 : w }),
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
      if (relRes.ok && relRes.data.relatorio) {
        const rel = relRes.data.relatorio as RelatorioSaude;
        setRelatorio(rel);
        setEmotionalScore(computeEmotionalScore(rel.sentimentos, rel.periodo.total_alertas));
      }
    } catch {
      setError("Erro ao carregar avaliação de risco");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  // Fetch emotional avatars from user profile
  useEffect(() => {
    if (!usuario?.id) return;
    supabase
      .from("usuarios")
      .select("emotional_avatars")
      .eq("id", usuario.id)
      .single()
      .then(({ data }) => {
        if (data?.emotional_avatars && typeof data.emotional_avatars === "object") {
          setEmotionalAvatars(data.emotional_avatars as Record<string, string>);
        }
      });
  }, [usuario?.id]);

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

  // Resolve emotional avatar
  const emotionLevel = emotionalScore !== null ? getEmotionalLevel(emotionalScore) : null;
  const avatarKey = emotionLevel ? (avatarKeyMap[emotionLevel.label] || "neutra") : null;
  const emotionalAvatarUrl = avatarKey ? emotionalAvatars?.[avatarKey] : null;

  const hasEmotionalImage = emotionalAvatarUrl && emotionLevel;

  return (
    <div className="ampara-card overflow-hidden !p-0">
      <div className="flex min-h-[280px]">
        {/* Left: Emotional avatar image — full height, showing right side of face */}
        {hasEmotionalImage && !loading && (
          <div className="relative w-28 shrink-0 overflow-hidden rounded-l-2xl">
            <img
              src={emotionalAvatarUrl}
              alt={emotionLevel.label}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "70% center" }}
            />
            {/* Gradient fade into card */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-card" />
            {/* Bottom label overlay */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
              <p className="text-[10px] font-semibold text-white leading-tight">{emotionLevel.label}</p>
              <p className="text-[8px] text-white/70">Saúde emocional</p>
            </div>
          </div>
        )}

        {/* Right: Card content */}
        <div className="flex-1 p-4 space-y-3">
          {/* Header */}
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
                <span className="text-2xl font-bold" style={{ color: level.color }}>
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
                onClick={() => setExpanded(!expanded)}
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
    </div>
  );
}
