import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { RefreshCw, Loader2 } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";
import { toast } from "sonner";

const OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
];

export default function RetentionSettingCard() {
  const { sessionToken } = useAuth();
  const [current, setCurrent] = useState<number>(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sessionToken) return;
    (async () => {
      const res = await callWebApi("getMe", sessionToken);
      if (res.ok && res.data?.usuario) {
        setCurrent(res.data.usuario.retencao_dias_sem_risco ?? 7);
      }
      setLoading(false);
    })();
  }, [sessionToken]);

  const handleChange = async (value: number) => {
    if (!sessionToken || value === current) return;
    setSaving(true);
    const res = await callWebApi("updateMe", sessionToken, {
      retencao_dias_sem_risco: value,
    });
    setSaving(false);
    if (res.ok) {
      setCurrent(value);
      toast.success("Período de retenção atualizado");
    } else {
      toast.error("Erro ao atualizar configuração");
    }
  };

  if (!sessionToken) return null;

  return (
    <div className="ampara-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <GradientIcon icon={RefreshCw} size="sm" />
        <div>
          <p className="text-sm font-semibold text-foreground">Retenção de gravações</p>
          <p className="text-xs text-muted-foreground">
            Gravações sem risco serão excluídas automaticamente após o período selecionado
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {OPTIONS.map((opt) => {
            const isActive = current === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleChange(opt.value)}
                disabled={saving}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                  isActive
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-background text-muted-foreground border-border hover:bg-accent/50"
                }`}
              >
                {saving && isActive ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  opt.label
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
