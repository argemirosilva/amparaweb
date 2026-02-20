import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, ShieldCheck, ShieldAlert, Lock, Eye, Clock, XCircle, CheckCircle, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { callSupportApi } from "@/services/supportApiService";

const SCOPE_LABELS: Record<string, string> = {
  read_metadata: "Metadados",
  read_transcription: "Transcrição",
  read_audio_stream: "Áudio (streaming)",
  read_analysis: "Análise",
  read_logs: "Logs técnicos",
};

const RESOURCE_LABELS: Record<string, string> = {
  recording: "Gravação",
  transcription: "Transcrição",
  analysis: "Análise",
  metadata: "Metadados",
  logs: "Logs",
};

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

interface Message {
  id: string;
  sender_type: string;
  message_text: string;
  created_at: string;
}

interface AccessRequest {
  id: string;
  resource_type: string;
  resource_id: string;
  requested_scope: string;
  justification_text: string;
  status: string;
  code_expires_at: string;
  created_at: string;
  support_access_grants: Array<{
    id: string;
    active: boolean;
    expires_at: string;
    revoked_at: string | null;
  }>;
}

interface AuditItem {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

export default function SupportTicketDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { sessionToken } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [codeData, setCodeData] = useState<{ requestId: string; code: string; expiresAt: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [confirming, setConfirming] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionToken || !sessionId) return;
    try {
      const res = await callSupportApi("getMySession", sessionToken, { session_id: sessionId });
      if (res.ok && res.data?.data) {
        setSession(res.data.data.session);
        setMessages(res.data.data.messages || []);
        setAccessRequests(res.data.data.access_requests || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [sessionToken, sessionId]);

  const loadAudit = useCallback(async () => {
    if (!sessionToken || !sessionId) return;
    try {
      const res = await callSupportApi("getAuditTimeline", sessionToken, { session_id: sessionId });
      if (res.ok && res.data?.data?.items) {
        setAuditItems(res.data.data.items);
      }
    } catch { /* ignore */ }
  }, [sessionToken, sessionId]);

  useEffect(() => { loadSession(); loadAudit(); }, [loadSession, loadAudit]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      loadSession();
      loadAudit();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadSession, loadAudit]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!sessionToken || !sessionId || !newMsg.trim()) return;
    setSending(true);
    try {
      const res = await callSupportApi("sendUserMessage", sessionToken, {
        session_id: sessionId,
        message_text: newMsg.trim(),
      });
      if (res.ok) {
        setNewMsg("");
        loadSession();
      } else {
        toast.error(res.data?.error || "Erro ao enviar.");
      }
    } catch {
      toast.error("Erro ao enviar mensagem.");
    }
    setSending(false);
  };

  const handleShowCode = async (requestId: string) => {
    if (!sessionToken) return;
    try {
      const res = await callSupportApi("showCode", sessionToken, { request_id: requestId });
      if (res.ok && res.data?.data) {
        setCodeData({ requestId, code: res.data.data.code, expiresAt: res.data.data.expires_at });
      } else {
        toast.error(res.data?.error || "Erro ao gerar código.");
      }
    } catch {
      toast.error("Erro ao gerar código.");
    }
  };

  const handleConfirmAccess = async (requestId: string) => {
    if (!sessionToken || !confirmCode.trim()) return;
    setConfirming(true);
    try {
      const res = await callSupportApi("confirmAccess", sessionToken, {
        request_id: requestId,
        code: confirmCode.trim(),
      });
      if (res.ok) {
        toast.success("Acesso concedido por 10 minutos.");
        setCodeData(null);
        setConfirmCode("");
        loadSession();
      } else {
        toast.error(res.data?.error || "Código inválido.");
      }
    } catch {
      toast.error("Erro ao confirmar.");
    }
    setConfirming(false);
  };

  const handleDenyAccess = async (requestId: string) => {
    if (!sessionToken) return;
    try {
      const res = await callSupportApi("denyAccess", sessionToken, { request_id: requestId });
      if (res.ok) {
        toast.success("Acesso recusado.");
        loadSession();
      }
    } catch { /* ignore */ }
  };

  const handleRevokeAll = async () => {
    if (!sessionToken || !sessionId) return;
    try {
      const res = await callSupportApi("revokeAllAccess", sessionToken, { session_id: sessionId });
      if (res.ok) {
        toast.success("Todos os acessos revogados.");
        loadSession();
      }
    } catch { /* ignore */ }
  };

  // Active grants
  const activeGrants = accessRequests.flatMap((r) =>
    (r.support_access_grants || [])
      .filter((g) => g.active && new Date(g.expires_at) > new Date())
      .map((g) => ({ ...g, resource_type: r.resource_type, requested_scope: r.requested_scope }))
  );

  const pendingRequests = accessRequests.filter((r) => r.status === "pending");

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/support")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-display font-bold text-foreground truncate">Chamado</h1>
        {session?.status && (
          <Badge variant="outline" className="text-xs shrink-0">
            {session.status === "closed" ? "Encerrado" : "Ativo"}
          </Badge>
        )}
      </div>

      {/* Security card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-foreground space-y-0.5">
            <p className="font-medium">Sua segurança</p>
            <p className="text-muted-foreground">Nenhum dado sensível é acessado sem sua autorização. Se pedirem acesso, você verá um código nesta tela. Você pode revogar a qualquer momento.</p>
          </div>
        </CardContent>
      </Card>

      {/* Active grants banner */}
      {activeGrants.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-700">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Acesso ativo</span>
            </div>
            {activeGrants.map((g) => (
              <div key={g.id} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                <span>{SCOPE_LABELS[g.requested_scope] || g.requested_scope}</span>
                <span>·</span>
                <GrantCountdown expiresAt={g.expires_at} />
              </div>
            ))}
            <Button variant="destructive" size="sm" className="w-full gap-1.5 mt-1" onClick={handleRevokeAll}>
              <Lock className="w-3.5 h-3.5" />
              Encerrar acesso agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending access requests */}
      {pendingRequests.map((r) => (
        <Card key={r.id} className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-foreground">Solicitação de Acesso</span>
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p><strong>Recurso:</strong> {RESOURCE_LABELS[r.resource_type] || r.resource_type}</p>
              <p><strong>Escopo:</strong> {SCOPE_LABELS[r.requested_scope] || r.requested_scope}</p>
              <p><strong>Justificativa:</strong> {r.justification_text}</p>
              <CodeExpiryTimer expiresAt={r.code_expires_at} />
            </div>

            {codeData?.requestId === r.id ? (
              <div className="space-y-2">
                <div className="bg-background border border-border rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Seu código de consentimento:</p>
                  <p className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">{codeData.code}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Informe este código ao agente ou digite abaixo para autorizar.</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite o código"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    maxLength={6}
                    className="font-mono text-center tracking-widest"
                  />
                  <Button
                    size="sm"
                    disabled={confirming || confirmCode.length < 6}
                    onClick={() => handleConfirmAccess(r.id)}
                  >
                    {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Autorizar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1" onClick={() => handleShowCode(r.id)}>
                  <Eye className="w-3.5 h-3.5" />
                  Mostrar código
                </Button>
                <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => handleDenyAccess(r.id)}>
                  <XCircle className="w-3.5 h-3.5" />
                  Recusar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Tabs: Chat / Audit */}
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="chat" className="flex-1 gap-1.5">
            <Send className="w-3.5 h-3.5" /> Chat
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 gap-1.5">
            <History className="w-3.5 h-3.5" /> Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-3">
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.sender_type === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : m.sender_type === "system"
                      ? "bg-muted text-muted-foreground rounded-bl-sm italic text-xs"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message_text}</p>
                  <p className={`text-[10px] mt-1 ${m.sender_type === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {session?.status !== "closed" && (
            <div className="flex gap-2 mt-3">
              <Input
                placeholder="Digite sua mensagem..."
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                maxLength={2000}
              />
              <Button size="icon" disabled={sending || !newMsg.trim()} onClick={handleSendMessage}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-3">
          <div className="space-y-2">
            {auditItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum evento registrado.</p>
            ) : (
              auditItems.map((item) => {
                const Icon = AUDIT_ICONS[item.event_type] || ShieldCheck;
                return (
                  <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-border last:border-0">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(item.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GrantCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Expirado");
        return;
      }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return <span className="font-mono">{remaining}</span>;
}

function CodeExpiryTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setExpired(true);
        setRemaining("Expirado");
        return;
      }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setRemaining(`${min}:${String(sec).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <p className={`flex items-center gap-1 ${expired ? "text-destructive" : ""}`}>
      <Clock className="w-3 h-3" />
      {expired ? "Código expirado — clique em \"Mostrar código\" para gerar novo" : `Expira em ${remaining}`}
    </p>
  );
}
