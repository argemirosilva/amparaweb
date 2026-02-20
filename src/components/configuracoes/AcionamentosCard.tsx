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
  senha_coacao: { notificar_guardioes: boolean };
}

const DEFAULTS: AcionamentosConfig = {
  whatsapp_guardioes: { grave: true, critico: true },
  autoridades_190_180: { critico: false },
  senha_coacao: { notificar_guardioes: true },
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
        const fetched = res.data.configuracao.acionamentos;
        setConfig({
          whatsapp_guardioes: { ...DEFAULTS.whatsapp_guardioes, ...fetched.whatsapp_guardioes },
          autoridades_190_180: { ...DEFAULTS.autoridades_190_180, ...fetched.autoridades_190_180 },
          senha_coacao: { ...DEFAULTS.senha_coacao, ...fetched.senha_coacao },
        });
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
    } else if (path === "sc_guardioes") {
      next.senha_coacao = { ...next.senha_coacao, notificar_guardioes: value };
    }
    setConfig(next);
    save(next);
  };

  if (!sessionToken) return null;

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Bell className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Acionamentos Automáticos</h2>
      </div>

      {/* WhatsApp Guardiões */}
      <Card>
        <CardContent className="px-3 py-2 space-y-2">
          <p className="text-xs font-semibold text-foreground">WhatsApp para Guardiões</p>

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">Risco Grave</p>
            </div>
            <Switch checked={config.whatsapp_guardioes.grave} onCheckedChange={(v) => toggle("wg_grave", v)} disabled={saving} className="scale-90" />
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">Risco Crítico</p>
            </div>
            <Switch checked={config.whatsapp_guardioes.critico} onCheckedChange={(v) => toggle("wg_critico", v)} disabled={saving} className="scale-90" />
          </div>
        </CardContent>
      </Card>

      {/* Chamada de emergência 190/180 */}
      <Card>
        <CardContent className="px-3 py-2 space-y-2">
          <p className="text-xs font-semibold text-foreground">Chamada de emergência 190/180</p>

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">Ligar automaticamente em caso de pânico</p>
              <p className="text-[10px] text-muted-foreground">Um agente de voz transmitirá seus dados de localização e risco às autoridades.</p>
            </div>
            <Switch checked={config.autoridades_190_180.critico} onCheckedChange={(v) => toggle("au_critico", v)} disabled={saving} className="scale-90" />
          </div>
        </CardContent>
      </Card>

      {/* Senha de Coação */}
      <Card>
        <CardContent className="px-3 py-2 space-y-2">
          <p className="text-xs font-semibold text-foreground">Senha de Coação</p>

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">Notificar guardiões via WhatsApp</p>
            </div>
            <Switch checked={config.senha_coacao.notificar_guardioes} onCheckedChange={(v) => toggle("sc_guardioes", v)} disabled={saving} className="scale-90" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
