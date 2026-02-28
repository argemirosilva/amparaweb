import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callSupportApi } from "@/services/supportApiService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Clock } from "lucide-react";

const EVENT_ICONS: Record<string, string> = {
  session_created: "📋",
  agent_assigned: "👤",
  access_requested: "🔐",
  code_shown: "🔢",
  access_granted: "✅",
  data_accessed: "👁️",
  access_revoked: "🔒",
  access_expired: "⏰",
  session_closed: "🏁",
  password_reset_initiated: "🔑",
};

export default function SuporteAuditoria() {
  const { sessionToken } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    (async () => {
      // For admin audit view, we list all data_access_log entries
      // Since we don't have a dedicated action, we use the timeline from all sessions
      // For now, show audit timeline accessible to admin
      setLoading(false);
    })();
  }, [sessionToken]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6" style={{ color: "hsl(207 89% 42%)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "hsl(220 13% 18%)" }}>Auditoria de Suporte</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Logs de acesso a dados sensíveis e timeline de auditoria de sessões de suporte.
        Esta funcionalidade será expandida na próxima fase.
      </p>
      <div className="rounded-lg border p-8 text-center" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
        <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-muted-foreground">Relatórios detalhados de auditoria serão exibidos aqui.</p>
      </div>
    </div>
  );
}
