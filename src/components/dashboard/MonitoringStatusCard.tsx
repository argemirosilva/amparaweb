import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Clock, CalendarClock } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

interface Period { inicio: string; fim: string }

interface ActiveSession {
  window_start_at: string | null;
  window_end_at: string | null;
}

function getTodayScheduleLabel(periodos: Record<string, Period[]>): string {
  const todayKey = DAY_KEYS[new Date().getDay()];
  const periods = periodos?.[todayKey];
  if (!periods || periods.length === 0) return "Sem horário";

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  for (const p of periods) {
    const [hI, mI] = p.inicio.split(":").map(Number);
    const [hF, mF] = p.fim.split(":").map(Number);
    if (nowMin >= hI * 60 + mI && nowMin < hF * 60 + mF) {
      return `${p.inicio} – ${p.fim}`;
    }
  }

  const upcoming = periods
    .map(p => ({ ...p, min: parseInt(p.inicio.split(":")[0]) * 60 + parseInt(p.inicio.split(":")[1]) }))
    .filter(p => p.min > nowMin)
    .sort((a, b) => a.min - b.min);

  if (upcoming.length > 0) return `Próximo: ${upcoming[0].inicio}`;
  return "Sem mais hoje";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function MonitoringStatusCard() {
  const { usuario } = useAuth();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [scheduleLabel, setScheduleLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario) return;

    Promise.all([
      // 1. Check device_status.is_monitoring
      supabase
        .from("device_status")
        .select("is_monitoring")
        .eq("user_id", usuario.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 2. Check active session with window times
      supabase
        .from("monitoramento_sessoes")
        .select("window_start_at, window_end_at, status")
        .eq("user_id", usuario.id)
        .in("status", ["ativa", "aguardando_finalizacao", "inserida_no_fluxo"])
        .order("iniciado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // 3. Schedule fallback
      supabase
        .from("agendamentos_monitoramento")
        .select("periodos_semana")
        .eq("user_id", usuario.id)
        .maybeSingle(),
    ]).then(([deviceRes, sessionRes, scheduleRes]) => {
      const deviceMonitoring = deviceRes.data?.is_monitoring ?? false;
      const hasSession = !!sessionRes.data;

      setIsMonitoring(deviceMonitoring || hasSession);
      setActiveSession(sessionRes.data as ActiveSession | null);

      if (scheduleRes.data?.periodos_semana) {
        setScheduleLabel(getTodayScheduleLabel(scheduleRes.data.periodos_semana as unknown as Record<string, Period[]>));
      }
      setLoading(false);
    });
  }, [usuario]);

  if (loading) {
    return (
      <div className="ampara-card p-3">
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  // Determine the period label
  const periodLabel = activeSession?.window_start_at && activeSession?.window_end_at
    ? `${formatTime(activeSession.window_start_at)} – ${formatTime(activeSession.window_end_at)}`
    : scheduleLabel || "Sem horário";

  return (
    <div className="ampara-card px-4 py-3">
      <div className="flex items-center gap-2.5 mb-2">
        <GradientIcon icon={Shield} size="sm" />
        <p className="text-sm font-semibold text-primary">Monitoramento</p>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Shield className="w-3 h-3" />
          Sessão:
          {isMonitoring ? (
            <span className="text-emerald-600 font-medium">Ativa</span>
          ) : (
            <span className="text-muted-foreground font-medium">Inativa</span>
          )}
        </span>

        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {activeSession ? <CalendarClock className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {activeSession ? "Período:" : "Hoje:"} {periodLabel}
        </span>
      </div>
    </div>
  );
}
