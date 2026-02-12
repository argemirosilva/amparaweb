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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Compartilhamento de GPS</h2>
      </div>

      <Card>
        <CardContent className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Alerta de Pânico</p>
              
            </div>
            <Switch checked={gpsPanico} onCheckedChange={handlePanico} />
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Risco Alto / Crítico</p>
              
            </div>
            <Switch checked={gpsRiscoAlto} onCheckedChange={handleRisco} />
          </div>

          {gpsEnabled && (
            <>
              <div className="border-t border-border" />

              <div>
                <p className="text-sm font-medium text-foreground mb-1.5">Duração do compartilhamento</p>
                
                <div className="flex gap-2">
                  {DURACAO_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleDuracao(opt.value)}
                      className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
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
