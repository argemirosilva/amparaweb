import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell } from "lucide-react";
import { toast } from "sonner";

interface AcionamentosConfig {
  whatsapp_guardioes: { grave: boolean; critico: boolean };
  autoridades_190_180: { critico: boolean };
}

const DEFAULTS: AcionamentosConfig = {
  whatsapp_guardioes: { grave: true, critico: true },
  autoridades_190_180: { critico: false },
};

export default function AcionamentosCard() {
  const { sessionToken } = useAuth();
  const [config, setConfig] = useState<AcionamentosConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await callWebApi("getAlertTriggers", sessionToken);
      if (res.ok && res.data?.configuracao?.acionamentos) {
        setConfig(res.data.configuracao.acionamentos);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const save = async (updated: AcionamentosConfig) => {
    if (!sessionToken || saving) return;
    setSaving(true);
    try {
      const res = await callWebApi("updateAlertTriggers", sessionToken, { acionamentos: updated });
      if (res.ok) {
        toast.success("Configurações salvas");
      } else {
        toast.error("Erro ao salvar configurações");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggle = (path: string, value: boolean) => {
    const next = { ...config };
    if (path === "wg_grave") {
      next.whatsapp_guardioes = { ...next.whatsapp_guardioes, grave: value };
    } else if (path === "wg_critico") {
      next.whatsapp_guardioes = { ...next.whatsapp_guardioes, critico: value };
    } else if (path === "au_critico") {
      next.autoridades_190_180 = { ...next.autoridades_190_180, critico: value };
    }
    setConfig(next);
    save(next);
  };

  if (!sessionToken) return null;

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Acionamentos Automáticos</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure quando o sistema deve notificar automaticamente.
      </p>

      {/* WhatsApp Guardiões */}
      <Card>
        <CardContent className="px-4 py-3 space-y-3">
          <p className="text-sm font-semibold text-foreground">WhatsApp para Guardiões</p>
          <p className="text-xs text-muted-foreground">
            Quando habilitado, o sistema notifica seus guardiões automaticamente.
          </p>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Alerta Grave</p>
              <p className="text-xs text-muted-foreground">Enviar WhatsApp em alerta grave</p>
            </div>
            <Switch
              checked={config.whatsapp_guardioes.grave}
              onCheckedChange={(v) => toggle("wg_grave", v)}
              disabled={saving}
            />
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Alerta Crítico</p>
              <p className="text-xs text-muted-foreground">Enviar WhatsApp em alerta crítico</p>
            </div>
            <Switch
              checked={config.whatsapp_guardioes.critico}
              onCheckedChange={(v) => toggle("wg_critico", v)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Autoridades */}
      <Card>
        <CardContent className="px-4 py-3 space-y-3">
          <p className="text-sm font-semibold text-foreground">Autoridades (190 e 180)</p>
          <p className="text-xs text-muted-foreground">
            Quando habilitado, o sistema pode acionar automaticamente os canais 190 e 180 em situações críticas.
          </p>

          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Alerta Crítico</p>
              <p className="text-xs text-muted-foreground">Acionar 190/180 em alerta crítico</p>
            </div>
            <Switch
              checked={config.autoridades_190_180.critico}
              onCheckedChange={(v) => toggle("au_critico", v)}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
