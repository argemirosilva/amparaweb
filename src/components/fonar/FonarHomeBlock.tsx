import { useNavigate } from "react-router-dom";
import { ClipboardList, ChevronRight } from "lucide-react";
import { useFonarStatus, useFonarOverview } from "@/hooks/useFonar";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import FonarRiskComparison from "./FonarRiskComparison";
import FonarSuggestionCard from "./FonarSuggestionCard";

export default function FonarHomeBlock() {
  const enabled = useFonarStatus();
  const { data, loading, reload } = useFonarOverview();
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [amparaRisk, setAmparaRisk] = useState<{ level?: string; score?: number } | null>(null);

  useEffect(() => {
    if (!usuario?.id) return;
    supabase.from("risk_assessments")
      .select("risk_level, risk_score")
      .eq("usuario_id", usuario.id)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setAmparaRisk({ level: data.risk_level, score: data.risk_score });
      });
  }, [usuario?.id]);

  if (enabled === false) return null;
  if (enabled === null || loading) {
    return <div className="ampara-card p-5 animate-pulse h-44" />;
  }

  const hasSubmission = !!data?.submission;
  const pendingCount = data?.pending_suggestions?.length || 0;

  return (
    <div className="ampara-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/[0.08] flex items-center justify-center">
            <ClipboardList className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-display">
              Meu FONAR
            </p>
            <p className="text-sm font-semibold text-foreground">Formulário Nacional de Avaliação de Risco</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/fonar")}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          {hasSubmission ? "Revisar" : "Preencher"}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {hasSubmission ? (
        <FonarRiskComparison
          amparaLevel={amparaRisk?.level}
          amparaScore={amparaRisk?.score}
          fonarLevel={data?.risk?.risk_level}
          fonarScore={data?.risk?.risk_score ?? null}
        />
      ) : (
        <button
          onClick={() => navigate("/fonar")}
          className="w-full text-left p-4 rounded-2xl border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          <p className="text-sm font-semibold text-foreground">Comece sua avaliação FONAR</p>
          <p className="text-xs text-muted-foreground mt-1">
            Um questionário guiado para retratar seu contexto. Avaliação independente do motor da AMPARA.
          </p>
        </button>
      )}

      {pendingCount > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {pendingCount} sugestão{pendingCount > 1 ? "ões" : ""} de revisão
          </p>
          {data!.pending_suggestions.slice(0, 3).map((s) => (
            <FonarSuggestionCard key={s.id} {...s} onChanged={reload} />
          ))}
        </div>
      )}

      <button
        onClick={() => navigate("/fonar/historico")}
        className="mt-4 text-xs text-muted-foreground hover:text-foreground"
      >
        Ver histórico de versões →
      </button>
    </div>
  );
}
