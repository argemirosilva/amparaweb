import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Loader2, Eye, Lock, Clock, XCircle, CheckCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { callSupportApi } from "@/services/supportApiService";

const AUDIT_ICONS: Record<string, typeof ShieldCheck> = {
  session_created: ShieldCheck,
  agent_assigned: Eye,
  access_requested: ShieldAlert,
  code_shown: Eye,
  access_granted: CheckCircle,
  data_accessed: Eye,
  access_revoked: Lock,
  access_expired: Clock,
  session_closed: XCircle,
  password_reset_initiated: Lock,
};

interface AuditItem {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  session_id: string;
}

export default function SupportAudit() {
  const { sessionToken } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await callSupportApi("getAuditTimeline", sessionToken, {});
      if (res.ok && res.data?.data?.items) {
        setItems(res.data.data.items);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/support")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-display font-bold text-foreground">Auditoria de Suporte</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Aqui você pode ver tudo que o suporte fez em seus chamados. Transparência total.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum evento de auditoria encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = AUDIT_ICONS[item.event_type] || ShieldCheck;
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/support/tickets/${item.session_id}`)}
                className="w-full text-left"
              >
                <Card className="hover:bg-accent/30 transition-colors">
                  <CardContent className="p-3 flex items-start gap-2.5">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(item.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
