import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, AlertTriangle, Shield, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";

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

export default function RiskEvolutionCard() {
  const { sessionToken } = useAuth();
  const [window, setWindow] = useState<WindowDays>(7);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async (w: WindowDays) => {
    if (!sessionToken) return;
    setLoading(true);
    setError(null);
    try {
      const assessRes = await callWebApi("getRiskAssessment", sessionToken, { window_days: w });
      if (assessRes.ok && assessRes.data.assessment) {
        setAssessment(assessRes.data.assessment);
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
