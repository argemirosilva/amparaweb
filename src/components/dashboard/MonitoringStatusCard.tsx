import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

interface Period { inicio: string; fim: string }

type MonitoringState =
  | { type: "monitoring"; inicio: string; fim: string }
  | { type: "monitoring_no_window" }
  | { type: "next"; inicio: string }
  | { type: "outside" };

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function resolveState(periods: Period[]): MonitoringState {
  if (!periods || periods.length === 0) return { type: "outside" };

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const p of periods) {
    if (nowMin >= toMinutes(p.inicio) && nowMin < toMinutes(p.fim)) {
      return { type: "monitoring", inicio: p.inicio, fim: p.fim };
    }
  }

  const upcoming = periods
    .filter(p => toMinutes(p.inicio) > nowMin)
    .sort((a, b) => toMinutes(a.inicio) - toMinutes(b.inicio));

  if (upcoming.length > 0) return { type: "next", inicio: upcoming[0].inicio };

  return { type: "outside" };
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function MonitoringStatusCard() {
  const { usuario } = useAuth();
  const [state, setState] = useState<MonitoringState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!usuario) return;

    const [sessionRes, scheduleRes] = await Promise.all([
      supabase
        .from("monitoramento_sessoes")
        .select("window_start_at, window_end_at, status")
        .eq("user_id", usuario.id)
        .in("status", ["ativa", "aguardando_finalizacao", "inserida_no_fluxo"])
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("agendamentos_monitoramento")
        .select("periodos_semana")
        .eq("user_id", usuario.id)
        .maybeSingle(),
    ]);

    const hasActiveSession = !!sessionRes.data;
    const periodos = scheduleRes.data?.periodos_semana as unknown as Record<string, Period[]> | null;
    const todayKey = DAY_KEYS[new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay()];
    const todayPeriods = periodos?.[todayKey] ?? [];

    // If active session with window times, use those
    if (sessionRes.data?.window_start_at && sessionRes.data?.window_end_at) {
      setState({
        type: "monitoring",
        inicio: formatTime(sessionRes.data.window_start_at),
        fim: formatTime(sessionRes.data.window_end_at),
      });
    } else if (hasActiveSession) {
      // Session active but no window — use schedule period for today
      const scheduleState = resolveState(todayPeriods);
      if (scheduleState.type === "monitoring") {
        setState(scheduleState);
      } else if (todayPeriods.length > 0) {
        const lastPeriod = todayPeriods[todayPeriods.length - 1];
        setState({ type: "monitoring", inicio: todayPeriods[0].inicio, fim: lastPeriod.fim });
      } else {
        setState({ type: "monitoring_no_window" });
      }
    } else {
      setState(resolveState(todayPeriods));
    }

    setLoading(false);
  }, [usuario]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!usuario) return;

    const channel = supabase
      .channel("monitoring-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monitoramento_sessoes", filter: `user_id=eq.${usuario.id}` },
        () => fetchData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [usuario, fetchData]);

  if (loading) {
    return (
      <div className="ampara-card p-3">
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="ampara-card px-4 py-3">
      <div className="flex items-center gap-2.5">
        <GradientIcon icon={Shield} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">Monitoramento</p>
          {state?.type === "monitoring" && (
            <p className="text-xs font-medium text-emerald-600">
              Monitorando até {state.fim}
            </p>
          )}
          {state?.type === "monitoring_no_window" && (
            <p className="text-xs font-medium text-emerald-600">
              Monitorando
            </p>
          )}
          {state?.type === "next" && (
            <p className="text-xs font-medium text-amber-600">
              Inicia o monitoramento às {state.inicio}
            </p>
          )}
          {state?.type === "outside" && (
            <p className="text-xs font-medium text-muted-foreground">
              Fora do período de monitoramento
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
