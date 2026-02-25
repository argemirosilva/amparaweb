import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Ear } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

interface Period { inicio: string; fim: string }

type MonitoringState =
  | { type: "monitoring"; inicio: string; fim: string }
  | { type: "monitoring_no_window" }
  | { type: "next_today"; inicio: string }
  | { type: "next_other_day"; dayLabel: string; inicio: string }
  | { type: "no_schedule" };

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getSPNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
}

function resolveState(allPeriods: Record<string, Period[]> | null): MonitoringState {
  if (!allPeriods) return { type: "no_schedule" };

  const now = getSPNow();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todayIdx = now.getDay();
  const todayKey = DAY_KEYS[todayIdx];
  const todayPeriods = allPeriods[todayKey] ?? [];

  // Check if currently in a period
  for (const p of todayPeriods) {
    if (nowMin >= toMinutes(p.inicio) && nowMin < toMinutes(p.fim)) {
      return { type: "monitoring", inicio: p.inicio, fim: p.fim };
    }
  }

  // Check for upcoming period today
  const upcoming = todayPeriods
    .filter(p => toMinutes(p.inicio) > nowMin)
    .sort((a, b) => toMinutes(a.inicio) - toMinutes(b.inicio));

  if (upcoming.length > 0) {
    return { type: "next_today", inicio: upcoming[0].inicio };
  }

  // Look ahead up to 7 days for the next period
  for (let offset = 1; offset <= 7; offset++) {
    const dayIdx = (todayIdx + offset) % 7;
    const dayKey = DAY_KEYS[dayIdx];
    const periods = allPeriods[dayKey] ?? [];
    if (periods.length > 0) {
      const sorted = [...periods].sort((a, b) => toMinutes(a.inicio) - toMinutes(b.inicio));
      const label = offset === 1 ? "amanhã" : DAY_LABELS[dayIdx];
      return { type: "next_other_day", dayLabel: label, inicio: sorted[0].inicio };
    }
  }

  return { type: "no_schedule" };
}

export default function MonitoringStatusCard() {
  const { usuario } = useAuth();
  const [state, setState] = useState<MonitoringState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!usuario) return;

    const scheduleRes = await supabase
      .from("agendamentos_monitoramento")
      .select("periodos_semana")
      .eq("user_id", usuario.id)
      .maybeSingle();

    const periodos = scheduleRes.data?.periodos_semana as unknown as Record<string, Period[]> | null;

    setState(resolveState(periodos));
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
        <GradientIcon icon={Ear} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">
            {state?.type === "monitoring" || state?.type === "monitoring_no_window" ? "Monitorando" : "Monitoramento"}
          </p>
          {state?.type === "monitoring" && (
            <p className="text-xs font-medium text-blue-600">
              até {state.fim}
            </p>
          )}
          {state?.type === "next_today" && (
            <p className="text-xs font-medium text-blue-600">
              Próximo período hoje às {state.inicio}
            </p>
          )}
          {state?.type === "next_other_day" && (
            <p className="text-xs font-medium text-blue-600">
              Próximo período {state.dayLabel} às {state.inicio}
            </p>
          )}
          {state?.type === "no_schedule" && (
            <p className="text-xs font-medium text-muted-foreground">
              Nenhum período agendado
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
