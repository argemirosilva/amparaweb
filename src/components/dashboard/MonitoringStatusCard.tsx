import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Clock } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

// Active session statuses (not just "ativa")
const ACTIVE_STATUSES = ["ativa", "aguardando_finalizacao", "inserida_no_fluxo"];

interface Period { inicio: string; fim: string }

interface ScheduleInfo {
  label: string;
  isActive: boolean;
}

function getTodayScheduleInfo(periodos: Record<string, Period[]>): ScheduleInfo {
  const todayKey = DAY_KEYS[new Date().getDay()];
  const periods = periodos?.[todayKey];
  if (!periods || periods.length === 0) return { label: "Sem horário", isActive: false };

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Check if currently within any period
  for (const p of periods) {
    const [hI, mI] = p.inicio.split(":").map(Number);
    const [hF, mF] = p.fim.split(":").map(Number);
    const inicioMin = hI * 60 + mI;
    const fimMin = hF * 60 + mF;

    if (nowMin >= inicioMin && nowMin < fimMin) {
      return { label: `${p.inicio} – ${p.fim}`, isActive: true };
    }
  }

  // Find next upcoming period today
  const upcoming = periods
    .map(p => ({ ...p, min: parseInt(p.inicio.split(":")[0]) * 60 + parseInt(p.inicio.split(":")[1]) }))
    .filter(p => p.min > nowMin)
    .sort((a, b) => a.min - b.min);

  if (upcoming.length > 0) {
    return { label: `Próximo: ${upcoming[0].inicio} – ${upcoming[0].fim}`, isActive: false };
  }

  return { label: "Sem mais hoje", isActive: false };
}

export default function MonitoringStatusCard() {
  const { usuario } = useAuth();
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [schedule, setSchedule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    Promise.all([
      supabase
        .from("monitoramento_sessoes")
        .select("id, status")
        .eq("user_id", usuario.id)
        .in("status", ACTIVE_STATUSES)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("agendamentos_monitoramento")
        .select("periodos_semana")
        .eq("user_id", usuario.id)
        .maybeSingle(),
    ]).then(([sessionRes, scheduleRes]) => {
      setSessionActive(!!sessionRes.data);
      if (scheduleRes.data?.periodos_semana) {
        const info = getTodayScheduleInfo(scheduleRes.data.periodos_semana as unknown as Record<string, Period[]>);
        setSchedule(info.label);
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
          {sessionActive ? (
            <span className="text-emerald-600 font-medium">Ativa</span>
          ) : (
            <span className="text-muted-foreground font-medium">Inativa</span>
          )}
        </span>

        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3" />
          Hoje: {schedule || "Sem horário"}
        </span>
      </div>
    </div>
  );
}
