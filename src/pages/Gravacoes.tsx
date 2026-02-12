import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import AnaliseCard from "@/components/dashboard/AnaliseCard";
import {
  Mic,
  Play,
  Pause,
  Download,
  Clock,
  HardDrive,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

// ... keep existing code (Gravacao interface, formatDuration, formatSize, formatDate, formatTime, STATUS_MAP)
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
}

function formatDuration(s: number | null): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  if (m > 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatSize(mb: number | null): string {
  if (!mb) return "—";
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  processando: { label: "Processando", variant: "default" },
  processado: { label: "Processado", variant: "default" },
  transcrito: { label: "Transcrito", variant: "default" },
  erro: { label: "Erro", variant: "destructive" },
};



// ... keep existing code (AudioPlayer component)
function AudioPlayer({ storagePath, sessionToken }: { storagePath: string; sessionToken: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  const loadUrl = useCallback(async () => {
    if (url) return;
    setLoading(true);
    setError(false);
    const res = await callWebApi("getGravacaoSignedUrl", sessionToken, { storage_path: storagePath });
    if (res.ok && res.data.url) {
      setUrl(res.data.url);
    } else {
      setError(true);
    }
    setLoading(false);
  }, [storagePath, sessionToken, url]);

  const toggle = async () => {
    if (!url) {
      await loadUrl();
      return;
    }
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  useEffect(() => {
    if (url && audioRef.current && !playing) {
      audioRef.current.play().catch(() => {});
    }
  }, [url]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = pct * duration;
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <button
        onClick={toggle}
        disabled={loading}
        className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4 text-primary" />
        ) : error ? (
          <X className="w-4 h-4 text-destructive" />
        ) : (
          <Play className="w-4 h-4 text-primary ml-0.5" />
        )}
      </button>

      <div
        className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer relative group"
        onClick={handleSeek}
      >
        <div
          className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums shrink-0">
        {duration ? formatDuration(duration) : "—"}
      </span>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); }}
          onLoadedMetadata={() => {
            if (audioRef.current) setDuration(audioRef.current.duration);
          }}
          onTimeUpdate={() => {
            if (audioRef.current && audioRef.current.duration) {
              setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
            }
          }}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

export default function GravacoesPage() {
  const { sessionToken } = useAuth();
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const perPage = 15;

  const loadData = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    const res = await callWebApi("getGravacoes", sessionToken, {
      page,
      per_page: perPage,
      ...(filterStatus ? { status: filterStatus } : {}),
    });
    if (res.ok) {
      setGravacoes(res.data.gravacoes);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [sessionToken, page, filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const downloadAudio = async (storagePath: string, fileName: string) => {
    const res = await callWebApi("getGravacaoSignedUrl", sessionToken!, { storage_path: storagePath });
    if (res.ok && res.data.url) {
      const a = document.createElement("a");
      a.href = res.data.url;
      a.download = fileName;
      a.target = "_blank";
      a.click();
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Gravações</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{total} gravação(ões)</span>
        </div>
      </div>

      {/* Record / Upload */}
      <AudioRecorderCard onUploaded={() => { setPage(1); loadData(); }} />

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["", "pendente", "processado", "transcrito", "erro"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {s === "" ? "Todas" : STATUS_MAP[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : gravacoes.length === 0 ? (
        <div className="ampara-card flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mic className="w-8 h-8 text-primary" />
          </div>
          <p className="text-foreground font-medium">Nenhuma gravação encontrada</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Grave um áudio ou envie um arquivo usando o painel acima.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {gravacoes.map((g) => {
            const isExpanded = expanded === g.id;
            const statusInfo = STATUS_MAP[g.status] || { label: g.status, variant: "secondary" as const };

            return (
              <div key={g.id} className="ampara-card overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : g.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Volume2 className="w-5 h-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {formatDate(g.created_at)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(g.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(g.duracao_segundos)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatSize(g.tamanho_mb)}
                      </span>
                    </div>
                  </div>

                  <Badge variant={statusInfo.variant} className="shrink-0 text-[10px]">
                    {statusInfo.label}
                  </Badge>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    {g.storage_path ? (
                      <AudioPlayer storagePath={g.storage_path} sessionToken={sessionToken!} />
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Áudio não disponível</p>
                    )}

                    {g.transcricao && (
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <FileText className="w-3 h-3" />
                          Transcrição
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {g.transcricao}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {g.storage_path && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAudio(g.storage_path!, `gravacao-${formatDate(g.created_at)}.m4a`)}
                          className="text-xs"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Baixar
                        </Button>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        ID: {g.id.slice(0, 8)}
                      </span>
                    </div>

                    {/* Análise de IA */}
                    <AnaliseCard
                      gravacaoId={g.id}
                      status={g.status}
                      sessionToken={sessionToken!}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
