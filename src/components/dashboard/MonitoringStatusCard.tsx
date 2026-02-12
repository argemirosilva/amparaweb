import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Clock } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

interface ScheduleInfo {
  label: string;
  isActive: boolean; // currently within the period
}

function getTodayScheduleInfo(periodos: Record<string, { ativo: boolean; inicio: string; fim: string }>): ScheduleInfo {
  const todayKey = DAY_KEYS[new Date().getDay()];
  const p = periodos?.[todayKey];
  if (!p?.ativo) return { label: "Sem horário", isActive: false };

  const now = new Date();
  const [hI, mI] = p.inicio.split(":").map(Number);
  const [hF, mF] = p.fim.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const inicioMin = hI * 60 + mI;
  const fimMin = hF * 60 + mF;

  if (nowMin >= inicioMin && nowMin < fimMin) {
    // Currently within period
    return { label: `${p.inicio} – ${p.fim}`, isActive: true };
  }
  if (nowMin < inicioMin) {
    // Period hasn't started yet
    return { label: `Próximo: ${p.inicio} – ${p.fim}`, isActive: false };
  }
  // Period already ended
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
        .eq("status", "ativa")
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
        setSchedule(getTodayScheduleInfo(scheduleRes.data.periodos_semana as any).label);
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
