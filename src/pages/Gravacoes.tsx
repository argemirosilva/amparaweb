import { useState, useEffect, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import PullToRefresh from "@/components/ui/pull-to-refresh";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import GravacaoExpandedContent from "@/components/gravacoes/GravacaoExpandedContent";
import GradientIcon from "@/components/ui/gradient-icon";
import {
  Mic,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Play,
  Smartphone,
  Monitor,
  HardDrive,
  Trash2,
} from "lucide-react";

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

const RISCO_COLORS: Record<string, string> = {
  sem_risco: "#22c55e",
  moderado: "#eab308",
  alto: "#f97316",
  critico: "#ef4444",
};

const RISCO_LABELS: Record<string, string> = {
  sem_risco: "Sem Risco",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
};

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
  if (!mb) return "";
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function getDeviceLabel(deviceId: string | null): { label: string; icon: typeof Smartphone } {
  if (!deviceId || deviceId === "web") return { label: "Web", icon: Monitor };
  return { label: "Celular", icon: Smartphone };
}

function getTranscriptionPreview(transcricao: string | null): string | null {
  if (!transcricao) return null;
  try {
    const segments = JSON.parse(transcricao);
    if (Array.isArray(segments) && segments.length > 0) {
      const firstText = segments[0]?.text || "";
      return firstText.length > 80 ? firstText.substring(0, 77) + "..." : firstText;
    }
  } catch {
    // plain text transcription
    return transcricao.length > 80 ? transcricao.substring(0, 77) + "..." : transcricao;
  }
  return null;
}

function formatDate(iso: string, compact = false): string {
  const d = new Date(iso);
  if (compact) return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);

  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff >= 2 && diff <= 6) {
    const weekday = d.toLocaleDateString("pt-BR", { weekday: "long" });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function groupByDate(items: Gravacao[]): { label: string; items: Gravacao[] }[] {
  const groups: Map<string, { label: string; items: Gravacao[] }> = new Map();
  for (const g of items) {
    const key = new Date(g.created_at).toLocaleDateString("pt-BR");
    if (!groups.has(key)) {
      groups.set(key, { label: getDateLabel(g.created_at), items: [] });
    }
    groups.get(key)!.items.push(g);
  }
  return Array.from(groups.values());
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  processando: { label: "Processando", variant: "default" },
  processado: { label: "Processado", variant: "default" },
  transcrito: { label: "Transcrito", variant: "default" },
  erro: { label: "Erro", variant: "destructive" },
};

function getRetentionCountdown(createdAt: string, retencaoDias: number): string | null {
  const expireAt = new Date(createdAt).getTime() + retencaoDias * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const remainingMs = expireAt - now;
  if (remainingMs <= 0) return "Será excluída em breve";
  const remainingHours = remainingMs / (1000 * 60 * 60);
  if (remainingHours < 24) {
    const h = Math.ceil(remainingHours);
    return `${h}h para exclusão`;
  }
  const days = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  return `${days}d para exclusão`;
}

export default function GravacoesPage() {
  const { sessionToken, usuario } = useAuth();
  const isMobile = useIsMobile();
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterRisco, setFilterRisco] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [retencaoDias, setRetencaoDias] = useState<number>(7);
  const perPage = 15;
  const loadDataRef = useRef<() => Promise<void>>();

  // Fetch user retention setting
  useEffect(() => {
    if (!sessionToken) return;
    callWebApi("getMe", sessionToken).then((res) => {
      if (res.ok && res.data?.usuario) {
        setRetencaoDias(res.data.usuario.retencao_dias_sem_risco ?? 7);
      }
    });
  }, [sessionToken]);

  const loadData = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    const res = await callWebApi("getGravacoes", sessionToken, {
      page,
      per_page: perPage,
      ...(filterRisco ? { nivel_risco: filterRisco } : {}),
    });
    if (res.ok) {
      setGravacoes(res.data.gravacoes);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [sessionToken, page, filterRisco]);

  // Keep ref in sync for realtime callback
  loadDataRef.current = loadData;

  const handleRefresh = useCallback(async () => {
    if (!sessionToken) return;
    const res = await callWebApi("getGravacoes", sessionToken, {
      page,
      per_page: perPage,
      ...(filterRisco ? { nivel_risco: filterRisco } : {}),
    });
    if (res.ok) {
      setGravacoes(res.data.gravacoes);
      setTotal(res.data.total);
    }
  }, [sessionToken, page, filterRisco]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: auto-refresh when gravacoes change
  useEffect(() => {
    if (!usuario) return;
    const channel = supabase
      .channel(`gravacoes-page-${usuario.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gravacoes", filter: `user_id=eq.${usuario.id}` },
        () => loadDataRef.current?.()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [usuario]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Gravações</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{total} {total === 1 ? "gravação" : "gravações"}</span>
        </div>
      </div>

      <AudioRecorderCard onUploaded={() => { setPage(1); loadData(); }} />

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["", "sem_risco", "moderado", "alto", "critico"].map((r) => {
          const isActive = filterRisco === r;
          const color = r ? RISCO_COLORS[r] : undefined;
          return (
            <button
              key={r}
              onClick={() => { setFilterRisco(r); setPage(1); }}
              className="px-2 py-0.5 rounded-full text-[10px] md:text-xs md:px-3 md:py-1 font-medium border transition-colors whitespace-nowrap"
              style={
                r === ""
                  ? isActive
                    ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "hsl(var(--primary))" }
                    : { backgroundColor: "hsl(var(--background))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                  : isActive
                    ? { backgroundColor: `${color}30`, color, borderColor: `${color}60` }
                    : { backgroundColor: `${color}10`, color: `${color}cc`, borderColor: `${color}25` }
              }
            >
              {r === "" ? "Todas" : RISCO_LABELS[r] || r}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <PullToRefresh onRefresh={handleRefresh} disabled={!isMobile || loading}>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : gravacoes.length === 0 ? (
        <div className="ampara-card flex flex-col items-center justify-center py-16 gap-3">
          <GradientIcon icon={Mic} size="lg" />
          <p className="text-foreground font-medium">Nenhuma gravação encontrada</p>
          <p className="text-sm text-muted-foreground text-center max-w-xs">
            Grave um áudio ou envie um arquivo usando o painel acima.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupByDate(gravacoes).map((group) => (
            <div key={group.label} className="space-y-0.5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">
                {group.label}
              </h2>
              {group.items.map((g) => {
                const isExpanded = expanded === g.id;
                const statusInfo = STATUS_MAP[g.status] || { label: g.status, variant: "secondary" as const };

                return (
                  <div
                    key={g.id}
                    ref={isExpanded ? (el) => { if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100); } : undefined}
                    className="ampara-card !p-0 !rounded-lg overflow-hidden relative"
                    style={g.nivel_risco ? { borderLeftWidth: "2px", borderLeftStyle: "solid", borderLeftColor: `${RISCO_COLORS[g.nivel_risco] || "transparent"}90` } : undefined}
                  >
                    <button
                      onClick={() => setExpanded(isExpanded ? null : g.id)}
                      className="w-full px-3 py-3.5 text-left hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <Play className="w-3 h-3 shrink-0 text-primary" />

                        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-medium text-foreground">
                              {formatTime(g.created_at)}
                            </span>
                            {(() => {
                              const device = getDeviceLabel(g.device_id);
                              const DeviceIcon = device.icon;
                              return <DeviceIcon className="w-2.5 h-2.5 text-muted-foreground" />;
                            })()}
                            <span className="text-[9px] text-muted-foreground inline-flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {formatDuration(g.duracao_segundos)}
                            </span>
                            {(g.status === "pendente" || g.status === "processando") && (
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground/60" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {g.nivel_risco && (
                              <span
                                className="text-[9px] font-bold px-2 py-0.5 rounded-full leading-4 border"
                                style={{
                                  backgroundColor: `${RISCO_COLORS[g.nivel_risco]}30`,
                                  color: RISCO_COLORS[g.nivel_risco],
                                  borderColor: `${RISCO_COLORS[g.nivel_risco]}50`,
                                }}
                              >
                                {RISCO_LABELS[g.nivel_risco] || g.nivel_risco}
                              </span>
                            )}
                            {statusInfo.variant === "destructive" && (
                              <Badge variant={statusInfo.variant} className="text-[8px] px-1.5 py-0 leading-4">
                                {statusInfo.label}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Retention countdown for sem_risco */}
                      {g.nivel_risco === "sem_risco" && (() => {
                        const countdown = getRetentionCountdown(g.created_at, retencaoDias);
                        if (!countdown) return null;
                        const expireAt = new Date(g.created_at).getTime() + retencaoDias * 24 * 60 * 60 * 1000;
                        const remainingHours = (expireAt - Date.now()) / (1000 * 60 * 60);
                        const isUrgent = remainingHours < 24;
                        return (
                          <div className="flex items-center gap-1 px-3 -mt-1 pb-1">
                            <Trash2 className={`w-2.5 h-2.5 ${isUrgent ? "text-destructive/70" : "text-muted-foreground/50"}`} />
                            <span className={`text-[9px] ${isUrgent ? "text-destructive/70 font-medium" : "text-muted-foreground/50"}`}>
                              {countdown}
                            </span>
                          </div>
                        );
                      })()}
                    </button>

                    {isExpanded && (
                      <GravacaoExpandedContent
                        gravacao={g}
                        sessionToken={sessionToken!}
                        onCollapse={() => setExpanded(null)}
                        onDeleted={() => { setExpanded(null); loadData(); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      </PullToRefresh>

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
