import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Headset, Plus, AlertTriangle, Loader2, ShieldCheck, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { callSupportApi } from "@/services/supportApiService";

const CATEGORY_LABELS: Record<string, string> = {
  app_issue: "Problema no app",
  playback: "Reprodução de áudio",
  upload: "Upload",
  gps: "GPS / Localização",
  notifications: "Notificações",
  account: "Conta",
  recording_question: "Dúvida sobre gravação",
  transcription_question: "Dúvida sobre transcrição",
  analysis_question: "Dúvida sobre análise",
  other: "Outro",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Aberto", color: "hsl(var(--primary))" },
  waiting_user: { label: "Aguardando você", color: "hsl(45, 93%, 47%)" },
  waiting_consent: { label: "Aguardando autorização", color: "hsl(45, 93%, 47%)" },
  active: { label: "Em atendimento", color: "hsl(142, 71%, 45%)" },
  closed: { label: "Encerrado", color: "hsl(var(--muted-foreground))" },
};

interface SessionItem {
  id: string;
  status: string;
  category: string;
  sensitivity_level: string;
  created_at: string;
  last_activity_at: string;
  has_active_grant: boolean;
}

export default function SupportHome() {
  const { sessionToken } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError(false);
    try {
      const res = await callSupportApi("myTickets", sessionToken, { limit: 20 });
      if (res.ok && res.data?.data?.items) {
        setSessions(res.data.data.items);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Headset className="w-6 h-6 text-primary" />
          Suporte Técnico
        </h1>
      </div>

      {/* Safety card */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="flex items-start gap-3 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">Este canal não é emergencial.</p>
            <p className="text-amber-700 dark:text-amber-300 mt-0.5">Em situação de risco, use o botão de emergência.</p>
          </div>
        </CardContent>
      </Card>

      {/* New ticket button */}
      <Button onClick={() => navigate("/support/new")} className="w-full gap-2">
        <Plus className="w-4 h-4" />
        Abrir novo chamado
      </Button>

      {/* Ticket list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Meus Chamados</h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <p className="text-sm text-destructive">Não foi possível carregar.</p>
              <Button variant="outline" size="sm" onClick={loadSessions}>Tentar novamente</Button>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Você ainda não abriu nenhum chamado.</p>
            </CardContent>
          </Card>
        ) : (
          sessions.map((s) => {
            const statusInfo = STATUS_LABELS[s.status] || STATUS_LABELS.open;
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/support/tickets/${s.id}`)}
                className="w-full text-left"
              >
                <Card className="hover:bg-accent/30 transition-colors">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {CATEGORY_LABELS[s.category] || s.category}
                        </span>
                        {s.sensitivity_level === "sensitive" && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
                            Sensível
                          </Badge>
                        )}
                        {s.has_active_grant && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary text-primary animate-pulse">
                            Acesso ativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span
                          className="inline-flex items-center gap-1 font-medium"
                          style={{ color: statusInfo.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                          {statusInfo.label}
                        </span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>{new Date(s.last_activity_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
