import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Save, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import TimeSelect from "./TimeSelect";

const DIAS = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
] as const;

type DiaKey = (typeof DIAS)[number]["key"];

interface Periodo {
  inicio: string;
  fim: string;
}

type PeriodosSemana = Record<DiaKey, Periodo[]>;

const MAX_PERIODOS_DIA = 6;
const MAX_HORAS_DIA = 8;

function emptyWeek(): PeriodosSemana {
  return { seg: [], ter: [], qua: [], qui: [], sex: [], sab: [], dom: [] };
}

function minutesFromHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function totalHours(periodos: Periodo[]): number {
  return periodos.reduce((sum, p) => {
    const diff = minutesFromHHMM(p.fim) - minutesFromHHMM(p.inicio);
    return sum + Math.max(0, diff);
  }, 0) / 60;
}

function hasOverlap(periodos: Periodo[], skipIdx: number): string | null {
  for (let i = 0; i < periodos.length; i++) {
    if (i === skipIdx) continue;
    for (let j = i + 1; j < periodos.length; j++) {
      if (j === skipIdx) continue;
      const aStart = minutesFromHHMM(periodos[i].inicio);
      const aEnd = minutesFromHHMM(periodos[i].fim);
      const bStart = minutesFromHHMM(periodos[j].inicio);
      const bEnd = minutesFromHHMM(periodos[j].fim);
      // overlap if NOT (aEnd <= bStart || bEnd <= aStart)
      if (!(aEnd <= bStart || bEnd <= aStart)) {
        return "Períodos não podem se sobrepor";
      }
    }
  }
  return null;
}

function validateDay(periodos: Periodo[]): string | null {
  if (periodos.length > MAX_PERIODOS_DIA) return `Máximo de ${MAX_PERIODOS_DIA} períodos por dia`;
  for (const p of periodos) {
    if (!p.inicio || !p.fim) return "Horário inicial e final são obrigatórios";
    if (minutesFromHHMM(p.fim) <= minutesFromHHMM(p.inicio)) return "Horário final precisa ser maior que o inicial";
  }
  const overlap = hasOverlap(periodos, -1);
  if (overlap) return overlap;
  if (totalHours(periodos) > MAX_HORAS_DIA) return `Limite de ${MAX_HORAS_DIA}h por dia excedido`;
  return null;
}

export default function MonitoringScheduleEditor() {
  const { sessionToken } = useAuth();
  const [periodos, setPeriodos] = useState<PeriodosSemana>(emptyWeek());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<DiaKey, string>>>({});

  const fetchSchedule = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await callWebApi("getSchedules", sessionToken);
      if (res.ok && res.data?.periodos_semana) {
        const saved = res.data.periodos_semana as PeriodosSemana;
        setPeriodos({ ...emptyWeek(), ...saved });
      }
    } catch {
      // Start with empty
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const updatePeriodo = (dia: DiaKey, idx: number, field: "inicio" | "fim", value: string) => {
    setPeriodos((prev) => {
      const updated = { ...prev };
      updated[dia] = [...prev[dia]];
      updated[dia][idx] = { ...updated[dia][idx], [field]: value };
      return updated;
    });
    // Clear error for this day
    setErrors((prev) => ({ ...prev, [dia]: undefined }));
  };

  const addPeriodo = (dia: DiaKey) => {
    if (periodos[dia].length >= MAX_PERIODOS_DIA) {
      toast.error(`Máximo de ${MAX_PERIODOS_DIA} períodos por dia`);
      return;
    }
    setPeriodos((prev) => ({
      ...prev,
      [dia]: [...prev[dia], { inicio: "", fim: "" }],
    }));
  };

  const removePeriodo = (dia: DiaKey, idx: number) => {
    setPeriodos((prev) => ({
      ...prev,
      [dia]: prev[dia].filter((_, i) => i !== idx),
    }));
    setErrors((prev) => ({ ...prev, [dia]: undefined }));
  };

  const validateAll = (): boolean => {
    const newErrors: Partial<Record<DiaKey, string>> = {};
    let valid = true;
    for (const d of DIAS) {
      const err = validateDay(periodos[d.key]);
      if (err) {
        newErrors[d.key] = err;
        valid = false;
      }
    }
    setErrors(newErrors);
    return valid;
  };

  const handleSave = async () => {
    if (!sessionToken) return;
    if (!validateAll()) return;

    setSaving(true);
    try {
      const res = await callWebApi("updateSchedules", sessionToken, {
        periodos_semana: periodos,
      });

      if (res.ok) {
        toast.success("Configurações salvas");
      } else {
        toast.error(res.data?.error || "Erro ao salvar configurações");
      }
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (!sessionToken) return null;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Períodos de Monitoramento</h2>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure os horários em que o monitoramento ficará ativo. Máximo de {MAX_HORAS_DIA}h por dia.
      </p>

      <div className="grid gap-3">
        {DIAS.map((dia) => {
          const dayPeriodos = periodos[dia.key];
          const hours = totalHours(dayPeriodos);
          const dayError = errors[dia.key];

          return (
            <Card key={dia.key} className={dayError ? "border-destructive" : ""}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground w-8">{dia.label}</span>
                    {dayPeriodos.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {hours.toFixed(1)}h
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-primary"
                    onClick={() => addPeriodo(dia.key)}
                    disabled={dayPeriodos.length >= MAX_PERIODOS_DIA}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Período
                  </Button>
                </div>

                {dayPeriodos.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Sem monitoramento</p>
                )}

                {dayPeriodos.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <TimeSelect
                      value={p.inicio}
                      onChange={(v) => updatePeriodo(dia.key, idx, "inicio", v)}
                    />
                    <span className="text-muted-foreground text-xs">até</span>
                    <TimeSelect
                      value={p.fim}
                      onChange={(v) => updatePeriodo(dia.key, idx, "fim", v)}
                      scrollTo={p.inicio ? String(Math.min(23, parseInt(p.inicio.split(":")[0]) + 1)).padStart(2, "0") : undefined}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removePeriodo(dia.key, idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}

                {dayError && (
                  <p className="text-xs text-destructive">{dayError}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
