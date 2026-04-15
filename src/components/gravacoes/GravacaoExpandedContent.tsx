import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { callWebApi } from "@/services/webApiService";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
import { FileText, Trash2, MessageCircle, RotateCcw, Download, Volume2, FileWarning, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import WaveformPlayer, { type WaveformMarker } from "./WaveformPlayer";
import AnaliseCard from "@/components/dashboard/AnaliseCard";

interface AnaliseData {
  resumo: string | null;
  sentimento: string | null;
  nivel_risco: string | null;
  categorias: string[] | null;
  palavras_chave: string[] | null;
  xingamentos: string[] | null;
  analise_completa: any;
}

interface Gravacao {
  id: string;
  created_at: string;
  duracao_segundos: number | null;
  tamanho_mb: number | null;
  status: string;
  storage_path: string | null;
  transcricao: string | null;
  device_id: string | null;
  timezone: string | null;
  nivel_risco: string | null;
}

/** Maps nivel_risco value to CSS variable name */
function formatDur(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function riscoCssVar(nivel: string | null): string | undefined {
  if (!nivel) return undefined;
  return `--risco-${nivel.replace(/_/g, "-")}`;
}

/** Resolve a CSS variable to an actual HSL color string */
function resolveRiscoColor(nivel: string | null): string | null {
  const varName = riscoCssVar(nivel);
  if (!varName) return null;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val ? `hsl(${val})` : null;
}

export default function GravacaoExpandedContent({
  gravacao,
  sessionToken,
  onCollapse,
  onDeleted,
}: {
  gravacao: Gravacao;
  sessionToken: string;
  onCollapse?: () => void;
  onDeleted?: () => void;
}) {
  const [analise, setAnalise] = useState<AnaliseData | null>(null);
  const [loadedAnalise, setLoadedAnalise] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isPlayingRef = useRef(false);
  const isInteractingRef = useRef(false);
  const isAnaliseActiveRef = useRef(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      if (!isPlayingRef.current && !isInteractingRef.current && !isAnaliseActiveRef.current) {
        onCollapse?.();
      }
    }, 6000);
  }, [onCollapse]);

  // Start timer on mount
  useEffect(() => {
    resetCollapseTimer();
    return () => { if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current); };
  }, [resetCollapseTimer]);

  const handlePlayingChange = useCallback((isPlaying: boolean) => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    } else {
      resetCollapseTimer();
    }
  }, [resetCollapseTimer]);

  const handleInteractionStart = useCallback(() => {
    isInteractingRef.current = true;
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    isInteractingRef.current = false;
    resetCollapseTimer();
  }, [resetCollapseTimer]);

  const handleAnaliseActiveChange = useCallback((active: boolean) => {
    isAnaliseActiveRef.current = active;
    if (active) {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    } else {
      resetCollapseTimer();
    }
  }, [resetCollapseTimer]);

  // Fetch analysis when component mounts (for processado recordings, skip for sem_risco)
  useEffect(() => {
    if (gravacao.status !== "processado") {
      setLoadedAnalise(true);
      return;
    }
    callWebApi("getAnalise", sessionToken, { gravacao_id: gravacao.id }).then((res) => {
      if (res.ok && res.data.analise) {
        setAnalise(res.data.analise);
      }
      setLoadedAnalise(true);
    });
  }, [gravacao.id, gravacao.status, sessionToken]);

  const isSemRisco = gravacao.status === "sem_risco";

  const riscoColor = useMemo(
    () => resolveRiscoColor(gravacao.nivel_risco),
    [gravacao.nivel_risco]
  );

  // Compute waveform markers from keywords positions in transcription
  const markers: WaveformMarker[] = useMemo(() => {
    if (!analise?.palavras_chave?.length || !gravacao.transcricao || !riscoColor) return [];
    const text = gravacao.transcricao.toLowerCase();
    const totalLen = text.length;
    if (totalLen === 0) return [];

    const result: WaveformMarker[] = [];
    const seen = new Set<number>(); // avoid overlapping markers

    for (const kw of analise.palavras_chave) {
      if (kw.length < 3) continue;
      const idx = text.indexOf(kw.toLowerCase());
      if (idx >= 0) {
        const pos = Math.round((idx / totalLen) * 100);
        if (!seen.has(pos)) {
          seen.add(pos);
          result.push({ position: idx / totalLen, color: riscoColor, label: kw });
        }
      }
    }
    return result;
  }, [analise, gravacao.transcricao, riscoColor]);

  // Build highlighted transcription segments
  const transcriptionParts = useMemo(() => {
    if (!gravacao.transcricao) return null;
    if (!analise?.palavras_chave?.length) return null;

    const keywords = analise.palavras_chave.filter((kw) => kw.length > 2);
    if (!keywords.length) return null;

    const escaped = keywords.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(${escaped.join("|")})`, "gi");
    const parts = gravacao.transcricao.split(regex);

    return parts.map((part, i) => {
      const isKw = keywords.some((kw) => kw.toLowerCase() === part.toLowerCase());
      return { text: part, isHighlight: isKw, key: i };
    });
  }, [gravacao.transcricao, analise]);


  const cssVar = riscoCssVar(gravacao.nivel_risco);

  return (
    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
      {/* Waveform Player */}
      {gravacao.storage_path ? (
        <WaveformPlayer
          storagePath={gravacao.storage_path}
          sessionToken={sessionToken}
          markers={markers}
          accentCssVar={cssVar}
          durationHint={gravacao.duracao_segundos || undefined}
          onPlayingChange={handlePlayingChange}
        />
      ) : (
        <p className="text-xs text-muted-foreground italic">Áudio não disponível</p>
      )}

      {/* Transcription with highlights — hide for sem_risco */}
      {!isSemRisco && gravacao.transcricao && (
        <details
          className="rounded-lg border border-border/50 overflow-hidden group"
          onToggle={(e) => {
            if ((e.target as HTMLDetailsElement).open) handleInteractionStart();
            else handleInteractionEnd();
          }}
        >
          <summary className="flex items-center justify-between px-3 py-2 bg-muted/30 cursor-pointer select-none hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">Transcrição</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground group-open:hidden">+</span>
              <span className="text-[10px] text-muted-foreground hidden group-open:inline">−</span>
            </div>
          </summary>
          <div className="px-3 py-2.5 max-h-40 overflow-y-auto">
            <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {transcriptionParts
                ? transcriptionParts.map((p) =>
                    p.isHighlight ? (
                      <mark
                        key={p.key}
                        className="rounded px-0.5 py-px font-semibold"
                        style={{
                          backgroundColor: riscoColor ? `${riscoColor}20` : undefined,
                          color: riscoColor || undefined,
                          borderBottom: riscoColor ? `2px solid ${riscoColor}` : undefined,
                        }}
                      >
                        {p.text}
                      </mark>
                    ) : (
                      <span key={p.key}>{p.text}</span>
                    )
                  )
                : gravacao.transcricao}
            </p>
          </div>
        </details>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {/* Reprocess AI */}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1 text-muted-foreground hover:text-primary"
          disabled={reprocessing}
          onClick={async (e) => {
            e.stopPropagation();
            setReprocessing(true);
            try {
              const res = await callWebApi("reprocessarGravacao", sessionToken, { gravacao_id: gravacao.id });
              if (res.ok) {
                toast({ title: "Reprocessamento iniciado", description: "A análise será atualizada em breve." });
              } else {
                toast({ title: "Erro", description: res.data?.error || "Tente novamente.", variant: "destructive" });
              }
            } catch {
              toast({ title: "Erro", description: "Falha ao reprocessar.", variant: "destructive" });
            } finally {
              setReprocessing(false);
            }
          }}
        >
          <RotateCcw className={`w-3.5 h-3.5 ${reprocessing ? "animate-spin" : ""}`} />
          {reprocessing ? "Reprocessando…" : "Reprocessar IA"}
        </Button>

        {(!gravacao.nivel_risco || gravacao.nivel_risco === "sem_risco") && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir gravação?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A gravação e sua análise serão removidas permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    const res = await callWebApi("deleteGravacao", sessionToken, { gravacao_id: gravacao.id });
                    if (res.ok) {
                      toast({ title: "Gravação excluída", description: "A gravação foi removida com sucesso." });
                    } else {
                      toast({ title: "Erro ao excluir", description: res.data?.error || "Tente novamente.", variant: "destructive" });
                    }
                    onDeleted?.();
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {gravacao.storage_path && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1 text-muted-foreground hover:text-primary"
            disabled={downloading}
            onClick={async (e) => {
              e.stopPropagation();
              setDownloading(true);
              try {
                const proxyUrl = `${SUPABASE_URL}/functions/v1/web-api?action=proxyAudio&session_token=${encodeURIComponent(sessionToken)}&storage_path=${encodeURIComponent(gravacao.storage_path!)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error("Erro ao baixar");
                const blob = await res.blob();
                const ext = gravacao.storage_path!.split('.').pop() || 'mp3';
                const dateStr = new Date(gravacao.created_at).toISOString().slice(0, 10);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `gravacao-${dateStr}-${gravacao.id.slice(0, 8)}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                toast({ title: "Erro ao baixar", description: "Não foi possível baixar o áudio.", variant: "destructive" });
              } finally {
                setDownloading(false);
              }
            }}
          >
            <Download className={`w-3.5 h-3.5 ${downloading ? "animate-pulse" : ""}`} />
            {downloading ? "Baixando…" : "Baixar"}
          </Button>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          ID: {gravacao.id.slice(0, 8)}
        </span>
      </div>

      {/* AI Analysis Card - hide for sem_risco */}
      {!isSemRisco && (
        <AnaliseCard
          gravacaoId={gravacao.id}
          status={gravacao.status}
          sessionToken={sessionToken}
          preloadedData={loadedAnalise ? analise : undefined}
          onActiveChange={handleAnaliseActiveChange}
        />
      )}

      {/* Sem risco notice */}
      {isSemRisco && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 text-center">
          Nenhum risco identificado — análise completa não aplicável.
        </div>
      )}

    </div>
  );
}

function SupportShortcut({ gravacao }: { gravacao: Gravacao }) {
  const navigate = useNavigate();
  const label = `Gravação ${new Date(gravacao.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${new Date(gravacao.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  const baseParams = `resource_type=recording&resource_id=${gravacao.id}&resource_label=${encodeURIComponent(label)}`;

  const options = [
    { icon: Volume2, label: "Problema com o áudio", category: "playback", preMessage: "Estou com problema na reprodução do áudio desta gravação." },
    { icon: FileText, label: "Problema com a transcrição", category: "transcription_question", preMessage: "A transcrição desta gravação apresenta problemas." },
    { icon: FileWarning, label: "Problema com download", category: "app_issue", preMessage: "Não consigo baixar o arquivo desta gravação." },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1 text-muted-foreground hover:text-primary"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Pedir suporte
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.category}
            className="gap-2 text-xs cursor-pointer"
            onClick={() => navigate(`/support/new?category=${opt.category}&${baseParams}&pre_message=${encodeURIComponent(opt.preMessage)}`)}
          >
            <opt.icon className="w-3.5 h-3.5" />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
