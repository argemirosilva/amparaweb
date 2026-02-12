import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, Mic } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";

export default function MonitoringStatusCard() {
  const { usuario } = useAuth();
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    supabase
      .from("monitoramento_sessoes")
      .select("id, status")
      .eq("user_id", usuario.id)
      .eq("status", "ativa")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setSessionActive(!!data);
        setLoading(false);
      });
  }, [usuario]);

  if (loading) {
    return (
      <div className="ampara-card space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  return (
    <div className="ampara-card p-4 space-y-4">
      <div className="flex items-center gap-3">
        <GradientIcon icon={Shield} size="sm" />
        <h3 className="font-display font-semibold text-foreground">Status do Monitoramento</h3>
      </div>

      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-4 h-4" />
            Sessão atual
          </div>
          {sessionActive ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Ativa</Badge>
          ) : (
            <Badge variant="secondary">Não ativa</Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            Dentro do horário
          </div>
          <span className="text-foreground">—</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mic className="w-4 h-4" />
            Última gravação
          </div>
          <span className="text-foreground">—</span>
        </div>
      </div>
    </div>
  );
}
