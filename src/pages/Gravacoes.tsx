import { useState, useEffect, useCallback } from "react";
import WhatsAppImportWizard from "@/components/whatsapp/WhatsAppImportWizard";
import { useIsMobile } from "@/hooks/use-mobile";
import PullToRefresh from "@/components/ui/pull-to-refresh";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { callWebApi } from "@/services/webApiService";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import GravacaoExpandedContent from "@/components/gravacoes/GravacaoExpandedContent";
import GravacoesFilterBar from "@/components/gravacoes/GravacoesFilterBar";
import GradientIcon from "@/components/ui/gradient-icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  CheckSquare,
  X,
  MessageCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  iniciado_em: string | null;
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
  if (!s) return "-";
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
    return transcricao.length > 80 ? transcricao.substring(0, 77) + "..." : transcricao;
  }
  return null;
}

function formatDate(iso: string, tz?: string | null, compact = false): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = compact
    ? { day: "2-digit", month: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" };
  if (tz) opts.timeZone = tz;
  return d.toLocaleDateString("pt-BR", opts);
}

function formatTime(iso: string, tz?: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (tz) opts.timeZone = tz;
  return new Date(iso).toLocaleTimeString("pt-BR", opts);
}

function getDateLabel(iso: string, tz?: string | null): string {
  const d = new Date(iso);
  const tzOpts: Intl.DateTimeFormatOptions = tz ? { timeZone: tz } : {};
  const formatter = new Intl.DateTimeFormat("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit", ...tzOpts });
  const parts = formatter.formatToParts(d);
  const year = parseInt(parts.find(p => p.type === "year")!.value);
  const month = parseInt(parts.find(p => p.type === "month")!.value) - 1;
  const day = parseInt(parts.find(p => p.type === "day")!.value);
  const target = new Date(year, month, day);

  const nowParts = formatter.formatToParts(new Date());
  const nowYear = parseInt(nowParts.find(p => p.type === "year")!.value);
  const nowMonth = parseInt(nowParts.find(p => p.type === "month")!.value) - 1;
  const nowDay = parseInt(nowParts.find(p => p.type === "day")!.value);
  const today = new Date(nowYear, nowMonth, nowDay);

  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);

  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff >= 2 && diff <= 6) {
    const weekday = d.toLocaleDateString("pt-BR", { weekday: "long", ...tzOpts });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  if (year === nowYear) {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", ...tzOpts });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", ...tzOpts });
}

function getDisplayTime(g: Gravacao): string {
  return g.iniciado_em || g.created_at;
}

function groupByDate(items: Gravacao[]): { label: string; items: Gravacao[] }[] {
  const groups: Map<string, { label: string; items: Gravacao[] }> = new Map();
  for (const g of items) {
    const displayTime = getDisplayTime(g);
    const tz = g.timezone;
    const tzOpts: Intl.DateTimeFormatOptions = tz ? { timeZone: tz } : {};
    const key = new Date(displayTime).toLocaleDateString("pt-BR", tzOpts);
    if (!groups.has(key)) {
      groups.set(key, { label: getDateLabel(displayTime, tz), items: [] });
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
    return `${h}h para exclusão automática`;
  }
  const days = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  return `${days}d para exclusão automática`;
}

export default function GravacoesPage() {
  const { sessionToken } = useAuth();
  const isMobile = useIsMobile();
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterRisco, setFilterRisco] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [retencaoDias, setRetencaoDias] = useState<number>(7);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const perPage = 15;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  const semRiscoIds = gravacoes.filter(g => !g.nivel_risco || g.nivel_risco === "sem_risco").map(g => g.id);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === semRiscoIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(semRiscoIds));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    setBatchDeleting(true);
    let ok = 0;
    let fail = 0;
    for (const id of selected) {
      const res = await callWebApi("deleteGravacao", sessionToken!, { gravacao_id: id });
      if (res.ok) ok++; else fail++;
    }
    setBatchDeleting(false);
    exitSelectMode();
    loadData();
    toast({
      title: `${ok} gravação(ões) excluída(s)`,
      description: fail > 0 ? `${fail} falha(s) ao excluir.` : "Todas removidas com sucesso.",
      variant: fail > 0 ? "destructive" : undefined,
    });
  };

  useEffect(() => {
    if (!sessionToken) return;
    callWebApi("getMe", sessionToken).then((res) => {
      if (res.ok && res.data?.usuario) {
        setRetencaoDias(res.data.usuario.retencao_dias_sem_risco ?? 7);
      }
    });
  }, [sessionToken]);

  const buildFilterParams = useCallback(() => {
    const p: Record<string, any> = { page, per_page: perPage };
    if (filterRisco) p.nivel_risco = filterRisco;
    if (debouncedSearch) p.search_text = debouncedSearch;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [page, filterRisco, debouncedSearch, dateFrom, dateTo]);

  const loadData = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    const res = await callWebApi("getGravacoes", sessionToken, buildFilterParams());
    if (res.ok) {
      setGravacoes(res.data.gravacoes);
      setTotal(res.data.total);
    }
    setLoading(false);
  }, [sessionToken, buildFilterParams]);

  const handleRefresh = useCallback(async () => {
    if (!sessionToken) return;
    const res = await callWebApi("getGravacoes", sessionToken, buildFilterParams());
    if (res.ok) {
      setGravacoes(res.data.gravacoes);
      setTotal(res.data.total);
    }
  }, [sessionToken, buildFilterParams]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* ── Page header (Azure-style) ── */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Gravações</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Suas gravações de áudio</h1>
          <div className="flex items-center gap-2 text-sm">
            {!selectMode && semRiscoIds.length > 0 && (
              <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg" onClick={() => setSelectMode(true)}>
                <CheckSquare className="w-3.5 h-3.5" />
                Selecionar
              </Button>
            )}
            {selectMode && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1 rounded-lg" onClick={toggleSelectAll}>
                  {selected.size === semRiscoIds.length ? "Desmarcar todas" : `Selecionar todas (${semRiscoIds.length})`}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="text-xs gap-1 rounded-lg" disabled={selected.size === 0 || batchDeleting}>
                      <Trash2 className="w-3.5 h-3.5" />
                      {batchDeleting ? "Excluindo…" : `Excluir (${selected.size})`}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir {selected.size} gravação(ões)?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. As gravações selecionadas e suas análises serão removidas permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBatchDelete}>
                        Excluir {selected.size}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exitSelectMode}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <span className="text-muted-foreground text-xs bg-muted px-2.5 py-1 rounded-full font-medium">
              {total} {total === 1 ? "gravação" : "gravações"}
            </span>
          </div>
        </div>
      </div>

      {/* ── WhatsApp Import Card ── */}
      <button
        onClick={() => setWhatsAppOpen(true)}
        className="w-full rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5 hover:bg-[#25D366]/10 p-4 flex items-center gap-4 transition-all text-left group"
      >
        <div className="w-12 h-12 rounded-xl bg-[#25D366]/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <MessageCircle className="w-6 h-6 text-[#25D366]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Analisar conversa do WhatsApp</p>
          <p className="text-xs text-muted-foreground mt-0.5">Cole ou importe uma conversa para análise de risco</p>
        </div>
      </button>

      <WhatsAppImportWizard open={whatsAppOpen} onOpenChange={setWhatsAppOpen} onImportComplete={loadData} />

      {/* ── Recorder card ── */}
      <AudioRecorderCard onUploaded={() => { setPage(1); loadData(); }} />

      {/* ── Risk filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {["", "sem_risco", "moderado", "alto", "critico"].map((r) => {
          const isActive = filterRisco === r;
          const color = r ? RISCO_COLORS[r] : undefined;
          return (
            <button
              key={r}
              onClick={() => { setFilterRisco(r); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                isActive ? "shadow-sm" : "hover:shadow-sm"
              }`}
              style={
                r === ""
                  ? isActive
                    ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "hsl(var(--primary))" }
                    : { backgroundColor: "hsl(var(--background))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                  : isActive
                    ? { backgroundColor: `${color}20`, color, borderColor: `${color}50` }
                    : { backgroundColor: "hsl(var(--background))", color: `${color}cc`, borderColor: "hsl(var(--border))" }
              }
            >
              {r === "" ? "Todas" : RISCO_LABELS[r] || r}
            </button>
          );
        })}
      </div>

      {/* ── Advanced Filters ── */}
      <GravacoesFilterBar
        searchText={searchText}
        onSearchTextChange={setSearchText}
        dateFrom={dateFrom}
        onDateFromChange={(v) => { setDateFrom(v); setPage(1); }}
        dateTo={dateTo}
        onDateToChange={(v) => { setDateTo(v); setPage(1); }}
        onClear={() => { setSearchText(""); setDateFrom(""); setDateTo(""); setPage(1); }}
        hasActiveFilters={!!searchText || !!dateFrom || !!dateTo}
      />

      {/* ── Content ── */}
      <PullToRefresh onRefresh={handleRefresh} disabled={!isMobile || loading}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : gravacoes.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 flex flex-col items-center justify-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Mic className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-foreground font-semibold text-base">Nenhuma gravação encontrada</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Grave um áudio ou envie um arquivo usando o painel acima.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupByDate(gravacoes).map((group) => (
              <div key={group.label} className="space-y-2">
                <h2 className="text-xs font-semibold text-primary uppercase tracking-widest px-1">
                  {group.label}
                </h2>
                <div className="space-y-1.5">
                  {group.items.map((g) => {
                    const isExpanded = expanded === g.id;
                    const statusInfo = STATUS_MAP[g.status] || { label: g.status, variant: "secondary" as const };

                    return (
                      <div
                        key={g.id}
                        ref={isExpanded ? (el) => { if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100); } : undefined}
                        className={`rounded-xl border bg-card overflow-hidden transition-all duration-200 ${
                          isExpanded ? "shadow-md border-primary/20" : "shadow-sm hover:shadow-md border-border"
                        }`}
                        style={g.nivel_risco ? { borderLeftWidth: "3px", borderLeftStyle: "solid", borderLeftColor: `${RISCO_COLORS[g.nivel_risco] || "transparent"}90` } : undefined}
                      >
                        {selectMode && (!g.nivel_risco || g.nivel_risco === "sem_risco") && (
                          <div className="flex items-center px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(g.id)}
                              onCheckedChange={() => toggleSelect(g.id)}
                            />
                          </div>
                        )}
                        <button
                          onClick={() => {
                            if (selectMode && (!g.nivel_risco || g.nivel_risco === "sem_risco")) {
                              toggleSelect(g.id);
                              return;
                            }
                            const willExpand = !isExpanded;
                            if (willExpand) {
                              window.dispatchEvent(new CustomEvent("waveform-player-stop-all"));
                            }
                            setExpanded(isExpanded ? null : g.id);
                          }}
                          className="w-full px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {!selectMode && (
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isExpanded ? "bg-primary/15" : "bg-muted/50"
                              }`}>
                                <Play className={`w-3 h-3 ${isExpanded ? "text-primary" : "text-muted-foreground"}`} />
                              </div>
                            )}

                            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                  {formatTime(getDisplayTime(g), g.timezone)}
                                </span>
                                {(() => {
                                  const device = getDeviceLabel(g.device_id);
                                  const DeviceIcon = device.icon;
                                  return <DeviceIcon className="w-3 h-3 text-muted-foreground" />;
                                })()}
                                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(g.duracao_segundos)}
                                </span>
                                {g.nivel_risco === "sem_risco" && (() => {
                                  const displayTime = getDisplayTime(g);
                                  const countdown = getRetentionCountdown(displayTime, retencaoDias);
                                  if (!countdown) return null;
                                  const expireAt = new Date(displayTime).getTime() + retencaoDias * 24 * 60 * 60 * 1000;
                                  const remainingHours = (expireAt - Date.now()) / (1000 * 60 * 60);
                                  const isUrgent = remainingHours < 24;
                                  return (
                                    <TooltipProvider delayDuration={300}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`text-[10px] inline-flex items-center gap-0.5 cursor-help ${isUrgent ? "text-destructive/70 font-medium" : "text-muted-foreground/50"}`}>
                                            <Trash2 className="w-2.5 h-2.5" />
                                            {countdown}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-[220px] text-center">
                                          <p className="text-xs">Gravações sem risco são excluídas automaticamente após <strong>{retencaoDias} dias</strong>. Você pode alterar isso em Configurações.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  );
                                })()}
                                {(g.status === "pendente" || g.status === "processando") && (
                                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/60" />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {g.nivel_risco && (
                                  <span
                                    className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg leading-4 border"
                                    style={{
                                      backgroundColor: `${RISCO_COLORS[g.nivel_risco]}15`,
                                      color: RISCO_COLORS[g.nivel_risco],
                                      borderColor: `${RISCO_COLORS[g.nivel_risco]}30`,
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
              </div>
            ))}
          </div>
        )}
      </PullToRefresh>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums font-medium">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
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
