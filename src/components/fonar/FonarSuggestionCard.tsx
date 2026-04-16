import { AlertCircle, ChevronRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fonarService } from "@/services/fonarService";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  titulo: string;
  motivo: string;
  relevance: "baixa" | "media" | "alta" | "critica";
  onChanged?: () => void;
}

const REL_COLOR: Record<string, string> = {
  critica: "text-destructive bg-destructive/10",
  alta: "text-orange-600 bg-orange-500/10",
  media: "text-amber-600 bg-amber-500/10",
  baixa: "text-muted-foreground bg-muted",
};

export default function FonarSuggestionCard({ id, titulo, motivo, relevance, onChanged }: Props) {
  const navigate = useNavigate();

  const handleIgnore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fonarService.ignoreSuggestion(id);
    onChanged?.();
  };

  return (
    <button
      onClick={() => navigate(`/fonar?suggestion=${id}`)}
      className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted/50 transition-colors"
    >
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", REL_COLOR[relevance])}>
        <AlertCircle className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{titulo}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{motivo}</p>
      </div>
      <button
        onClick={handleIgnore}
        className="p-1 rounded-md hover:bg-muted text-muted-foreground/60 hover:text-foreground"
        aria-label="Ignorar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1" />
    </button>
  );
}
