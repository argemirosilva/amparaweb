import { ShieldAlert, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Level = "sem_risco" | "moderado" | "alto" | "critico" | string;

const LEVEL_LABEL: Record<string, string> = {
  sem_risco: "Sem risco",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
};

function levelClasses(level?: Level) {
  switch (level) {
    case "critico": return "text-destructive";
    case "alto": return "text-orange-500";
    case "moderado": return "text-amber-500";
    default: return "text-emerald-500";
  }
}

interface Props {
  amparaLevel?: Level;
  amparaScore?: number | null;
  fonarLevel?: Level;
  fonarScore?: number | null;
}

export default function FonarRiskComparison({ amparaLevel, amparaScore, fonarLevel, fonarScore }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Avaliação AMPARA
          </span>
        </div>
        <p className={cn("text-lg font-bold font-display", levelClasses(amparaLevel))}>
          {amparaLevel ? LEVEL_LABEL[amparaLevel] || amparaLevel : "Sem dados"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {amparaScore != null ? `Score ${amparaScore}` : "motor de IA"}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Avaliação FONAR
          </span>
        </div>
        <p className={cn("text-lg font-bold font-display", levelClasses(fonarLevel))}>
          {fonarLevel ? LEVEL_LABEL[fonarLevel] || fonarLevel : "Não preenchido"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {fonarScore != null ? `Score ${fonarScore}` : "autoavaliação"}
        </p>
      </div>
    </div>
  );
}
