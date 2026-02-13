import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { callWebApi } from "@/services/webApiService";
import { Button } from "@/components/ui/button";
import { Download, FileText, Trash2 } from "lucide-react";
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
  const isPlayingRef = useRef(false);
  const isInteractingRef = useRef(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      if (!isPlayingRef.current && !isInteractingRef.current) {
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

  // Fetch analysis when component mounts (for processado recordings)
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

  const downloadAudio = async () => {
    if (!gravacao.storage_path) return;
    const res = await callWebApi("getGravacaoSignedUrl", sessionToken, {
      storage_path: gravacao.storage_path,
    });
    if (res.ok && res.data.url) {
      const a = document.createElement("a");
      a.href = res.data.url;
      a.download = `gravacao-${gravacao.id.slice(0, 8)}.mp3`;
      a.target = "_blank";
      a.click();
    }
  };

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

      {/* Transcription with highlights */}
      {gravacao.transcricao && (
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
        {gravacao.storage_path && (
          <Button variant="outline" size="sm" onClick={downloadAudio} className="text-xs">
            <Download className="w-3 h-3 mr-1" />
            Baixar
          </Button>
        )}
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
                    await callWebApi("deleteGravacao", sessionToken, { gravacao_id: gravacao.id });
                    onDeleted?.();
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          ID: {gravacao.id.slice(0, 8)}
        </span>
      </div>

      {/* AI Analysis Card */}
      <AnaliseCard
        gravacaoId={gravacao.id}
        status={gravacao.status}
        sessionToken={sessionToken}
        preloadedData={loadedAnalise ? analise : undefined}
      />
    </div>
  );
}
