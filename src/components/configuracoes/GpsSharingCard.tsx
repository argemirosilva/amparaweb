import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

export default function GpsSharingCard() {
  const { sessionToken } = useAuth();
  const [gpsPanico, setGpsPanico] = useState(true);
  const [gpsRiscoAlto, setGpsRiscoAlto] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await callWebApi("getMe", sessionToken);
      if (res.ok && res.data?.usuario) {
        setGpsPanico(res.data.usuario.compartilhar_gps_panico ?? true);
        setGpsRiscoAlto(res.data.usuario.compartilhar_gps_risco_alto ?? true);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const update = async (field: string, value: boolean) => {
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

  if (!sessionToken) return null;

  if (loading) {
    return <Skeleton className="h-28 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Compartilhamento de GPS</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Defina quando sua localização será compartilhada com seus guardiões.
      </p>

      <Card>
        <CardContent className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Alerta de Pânico</p>
              <p className="text-xs text-muted-foreground">Compartilhar localização ao acionar o botão de pânico</p>
            </div>
            <Switch checked={gpsPanico} onCheckedChange={handlePanico} />
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Risco Alto / Crítico</p>
              <p className="text-xs text-muted-foreground">Compartilhar localização ao detectar risco alto ou crítico nas gravações</p>
            </div>
            <Switch checked={gpsRiscoAlto} onCheckedChange={handleRisco} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
