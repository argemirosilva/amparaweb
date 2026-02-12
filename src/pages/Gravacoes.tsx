import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import PullToRefresh from "@/components/ui/pull-to-refresh";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
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
  sem_risco: "hsl(var(--risco-sem-risco))",
  moderado: "hsl(var(--risco-moderado))",
  alto: "hsl(var(--risco-alto))",
  critico: "hsl(var(--risco-critico))",
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

function formatDate(iso: string, compact = false): string {
  const d = new Date(iso);
  if (compact) return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

export default function GravacoesPage() {
  const { sessionToken } = useAuth();
  const isMobile = useIsMobile();
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterRisco, setFilterRisco] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const perPage = 15;

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

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Gravações</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{total} gravação(ões)</span>
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
        <div className="space-y-1.5">
          {gravacoes.map((g) => {
            const isExpanded = expanded === g.id;
            const statusInfo = STATUS_MAP[g.status] || { label: g.status, variant: "secondary" as const };

            return (
              <div
                key={g.id}
                className="ampara-card overflow-hidden relative"
                style={g.nivel_risco ? { borderLeftWidth: "4px", borderLeftStyle: "solid", borderLeftColor: RISCO_COLORS[g.nivel_risco] || "transparent" } : undefined}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : g.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1 md:py-1.5 text-left hover:bg-accent/30 transition-colors"
                >
                  <GradientIcon icon={Play} size="sm" className="shrink-0" />

                  {/* Desktop: single row */}
                  {!isMobile ? (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">
                            {formatDate(g.created_at, false)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(g.created_at)}
                          </span>
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDuration(g.duracao_segundos)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {g.nivel_risco && (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${RISCO_COLORS[g.nivel_risco]}20`,
                              color: RISCO_COLORS[g.nivel_risco],
                            }}
                          >
                            {RISCO_LABELS[g.nivel_risco] || g.nivel_risco}
                          </span>
                        )}
                        <Badge variant={statusInfo.variant} className="text-[9px] px-1.5 py-0">
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </>
                  ) : (
                    /* Mobile: two compact rows */
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">
                            {formatDate(g.created_at, true)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(g.created_at)}
                          </span>
                        </div>
                        <Badge variant={statusInfo.variant} className="text-[9px] px-1.5 py-0">
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDuration(g.duracao_segundos)}
                        </span>
                        {g.nivel_risco && (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${RISCO_COLORS[g.nivel_risco]}20`,
                              color: RISCO_COLORS[g.nivel_risco],
                            }}
                          >
                            {RISCO_LABELS[g.nivel_risco] || g.nivel_risco}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <GravacaoExpandedContent
                    gravacao={g}
                    sessionToken={sessionToken!}
                  />
                )}
              </div>
            );
          })}
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
