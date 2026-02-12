import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

const DURACAO_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
];

export default function GpsSharingCard() {
  const { sessionToken } = useAuth();
  const [gpsPanico, setGpsPanico] = useState(true);
  const [gpsRiscoAlto, setGpsRiscoAlto] = useState(true);
  const [gpsDuracao, setGpsDuracao] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await callWebApi("getMe", sessionToken);
      if (res.ok && res.data?.usuario) {
        setGpsPanico(res.data.usuario.compartilhar_gps_panico ?? true);
        setGpsRiscoAlto(res.data.usuario.compartilhar_gps_risco_alto ?? true);
        setGpsDuracao(res.data.usuario.gps_duracao_minutos ?? 30);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const update = async (field: string, value: boolean | number) => {
    if (!sessionToken) return;
    const res = await callWebApi("updateMe", sessionToken, { [field]: value });
    if (res.ok) {
      toast.success("Configuração atualizada");
    } else {
      toast.error("Erro ao salvar configuração");
    }
  };

  const handlePanico = (checked: boolean) => {
    setGpsPanico(checked);
    update("compartilhar_gps_panico", checked);
  };

  const handleRisco = (checked: boolean) => {
    setGpsRiscoAlto(checked);
    update("compartilhar_gps_risco_alto", checked);
  };

  const handleDuracao = (value: number) => {
    setGpsDuracao(value);
    update("gps_duracao_minutos", value);
  };

  if (!sessionToken) return null;

  if (loading) {
    return <Skeleton className="h-28 w-full" />;
  }

  const gpsEnabled = gpsPanico || gpsRiscoAlto;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Compartilhamento de GPS</h2>
      </div>

      <Card>
        <CardContent className="px-3 py-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-foreground">Alerta de Pânico</p>
            <Switch checked={gpsPanico} onCheckedChange={handlePanico} className="scale-90" />
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-foreground">Risco Alto / Crítico</p>
            <Switch checked={gpsRiscoAlto} onCheckedChange={handleRisco} className="scale-90" />
          </div>

          {gpsEnabled && (
            <>
              <div className="border-t border-border" />
              <div>
                <p className="text-xs text-foreground mb-1">Duração</p>
                <div className="flex gap-1.5">
                  {DURACAO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleDuracao(opt.value)}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors"
                      style={
                        gpsDuracao === opt.value
                          ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderColor: "hsl(var(--primary))" }
                          : { backgroundColor: "hsl(var(--background))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
