import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { callSupportApi } from "@/services/supportApiService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Send, ShieldCheck, ShieldOff, Lock, Clock, Eye, X,
} from "lucide-react";

const SENDER_STYLES: Record<string, { bg: string; align: string; label: string }> = {
  agent: { bg: "hsl(224 76% 33% / 0.08)", align: "ml-auto", label: "Agente" },
  user: { bg: "hsl(142 76% 36% / 0.08)", align: "mr-auto", label: "Usuária" },
  system: { bg: "hsl(45 93% 47% / 0.08)", align: "mx-auto", label: "Sistema" },
};

export default function SuporteChat() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { sessionToken } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);

  // Access request form
  const [showAccessForm, setShowAccessForm] = useState(false);
  const [arResourceType, setArResourceType] = useState("recording");
  const [arResourceId, setArResourceId] = useState("");
  const [arScope, setArScope] = useState("read_metadata");
  const [arJustification, setArJustification] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [userResources, setUserResources] = useState<{ id: string; label: string }[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // Confirm code
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmRequestId, setConfirmRequestId] = useState("");
  const [confirmCode, setConfirmCode] = useState("");

  const fetchSession = async () => {
    if (!sessionToken || !sessionId) return;
    const { ok, data } = await callSupportApi("getSession", sessionToken, { session_id: sessionId });
    if (ok) {
      setSession(data.session);
      setMessages(data.messages || []);
      setAccessRequests(data.access_requests || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSession(); }, [sessionToken, sessionId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Poll for new messages every 5s
  useEffect(() => {
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [sessionToken, sessionId]);

  const sendMessage = async () => {
    if (!msgText.trim() || !sessionToken) return;
    setSending(true);
    const { ok } = await callSupportApi("sendMessage", sessionToken, {
      session_id: sessionId,
      message_text: msgText.trim(),
    });
    if (ok) {
      setMsgText("");
      fetchSession();
    }
    setSending(false);
  };

  const loadResources = async (type: string) => {
    if (!sessionToken || !session?.user_id) return;
    setLoadingResources(true);
    const { ok, data } = await callSupportApi("listUserResources", sessionToken, {
      target_user_id: session.user_id,
      resource_type: type,
    });
    if (ok && data?.data?.items) {
      setUserResources(data.data.items);
    } else {
      setUserResources([]);
    }
    setLoadingResources(false);
  };

  const openAccessForm = () => {
    setShowAccessForm(true);
    setArResourceType("recording");
    setArResourceId("");
    setArJustification("");
    loadResources("recording");
  };

  const handleResourceTypeChange = (type: string) => {
    setArResourceType(type);
    setArResourceId("");
    loadResources(type);
  };

  const handleRequestAccess = async () => {
    if (!arResourceId || !arJustification.trim()) return;
    setRequesting(true);
    const { ok, data } = await callSupportApi("requestAccess", sessionToken!, {
      session_id: sessionId,
      resource_type: arResourceType,
      resource_id: arResourceId,
      requested_scope: arScope,
      justification_text: arJustification.trim(),
    });
    if (ok) {
      toast({ title: "Solicitação enviada", description: `Código gerado: ${data.code}. Informe à usuária ou aguarde.` });
      setShowAccessForm(false);
      setArResourceId("");
      setArJustification("");
      fetchSession();
    } else {
      toast({ title: "Erro", description: data.error, variant: "destructive" });
    }
    setRequesting(false);
  };

  const handleConfirmAccess = async () => {
    if (!confirmCode || !confirmRequestId) return;
    const { ok, data } = await callSupportApi("confirmAccess", sessionToken!, {
      request_id: confirmRequestId,
      code: confirmCode,
    });
    if (ok) {
      toast({ title: "Acesso concedido", description: "Grant ativo por 10 minutos." });
      setShowConfirm(false);
      setConfirmCode("");
      fetchSession();
    } else {
      toast({ title: "Erro", description: data.error, variant: "destructive" });
    }
  };

  const handleRevoke = async (grantId: string) => {
    const { ok } = await callSupportApi("revokeAccess", sessionToken!, { grant_id: grantId });
    if (ok) {
      toast({ title: "Acesso revogado" });
      fetchSession();
    }
  };

  const handleClose = async () => {
    const { ok } = await callSupportApi("closeSession", sessionToken!, { session_id: sessionId });
    if (ok) {
      toast({ title: "Sessão encerrada" });
      fetchSession();
    }
  };

  const activeGrants = accessRequests
    .flatMap((r: any) => (r.support_access_grants || []).map((g: any) => ({ ...g, request: r })))
    .filter((g: any) => g.active && new Date(g.expires_at) > new Date());

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;
  if (!session) return <p className="text-sm text-destructive p-4">Sessão não encontrada.</p>;

  const isClosed = session.status === "closed";
  const user = session.usuarios;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/suporte")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{user?.nome_completo || "Usuária"}</h2>
          <p className="text-xs text-muted-foreground">{user?.email} · {session.category}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isClosed && (
            <>
              <Button size="sm" variant="outline" className="gap-1" onClick={openAccessForm}>
                <ShieldCheck className="w-4 h-4" /> Solicitar Acesso
              </Button>
              <Button size="sm" variant="destructive" className="gap-1" onClick={handleClose}>
                <X className="w-4 h-4" /> Encerrar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Chat */}
        <div className="flex-1 flex flex-col min-w-0 rounded-lg border" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => {
              const style = SENDER_STYLES[m.sender_type] || SENDER_STYLES.system;
              return (
                <div key={m.id} className={`max-w-[80%] ${style.align}`}>
                  <div className="rounded-lg px-3 py-2" style={{ background: style.bg }}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{style.label}</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: "hsl(220 13% 18%)" }}>{m.message_text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">
                      {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {!isClosed && (
            <div className="p-3 border-t flex gap-2" style={{ borderColor: "hsl(220 13% 91%)" }}>
              <Input
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Escreva uma mensagem..."
                className="flex-1"
              />
              <Button size="icon" onClick={sendMessage} disabled={sending || !msgText.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar — Grants & Info */}
        <div className="w-72 shrink-0 space-y-4 hidden lg:block">
          {/* User info */}
          <div className="rounded-lg border p-4" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
            <h3 className="font-semibold text-sm mb-2">Dados da Usuária</h3>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p><strong>Nome:</strong> {user?.nome_completo}</p>
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Status:</strong> {user?.status}</p>
              <p><strong>Desde:</strong> {user?.created_at ? format(new Date(user.created_at), "dd/MM/yyyy") : "-"}</p>
            </div>
          </div>

          {/* Active grants */}
          {activeGrants.length > 0 && (
            <div className="rounded-lg border p-4" style={{ background: "hsl(142 76% 36% / 0.05)", borderColor: "hsl(142 76% 36% / 0.2)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4" style={{ color: "hsl(142 76% 36%)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "hsl(142 76% 36%)" }}>Modo Observador</h3>
              </div>
              {activeGrants.map((g: any) => (
                <div key={g.id} className="text-xs space-y-1 mb-3 pb-3 border-b last:border-0" style={{ borderColor: "hsl(142 76% 36% / 0.15)" }}>
                  <p><strong>Recurso:</strong> {g.request.resource_type}</p>
                  <p><strong>Escopo:</strong> {g.request.requested_scope}</p>
                  <div className="flex items-center gap-1 text-orange-600">
                    <Clock className="w-3 h-3" />
                    <GrantCountdown expiresAt={g.expires_at} />
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-1 gap-1 text-destructive" onClick={() => handleRevoke(g.id)}>
                    <ShieldOff className="w-3 h-3" /> Revogar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Pending requests — confirm code */}
          {accessRequests
            .filter((r: any) => r.status === "pending")
            .map((r: any) => (
              <div key={r.id} className="rounded-lg border p-4" style={{ background: "hsl(45 93% 47% / 0.05)", borderColor: "hsl(45 93% 47% / 0.2)" }}>
                <p className="text-xs font-medium mb-2">Aguardando código de consentimento</p>
                <p className="text-xs text-muted-foreground mb-2">{r.resource_type} · {r.requested_scope}</p>
                <Button size="sm" variant="outline" className="w-full" onClick={() => { setConfirmRequestId(r.id); setShowConfirm(true); }}>
                  <Lock className="w-3 h-3 mr-1" /> Inserir Código
                </Button>
              </div>
            ))}
        </div>
      </div>

      {/* Access Request Modal */}
      <Dialog open={showAccessForm} onOpenChange={setShowAccessForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Acesso a Recurso</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Recurso</Label>
              <Select value={arResourceType} onValueChange={handleResourceTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recording">Gravação</SelectItem>
                  <SelectItem value="transcription">Transcrição</SelectItem>
                  <SelectItem value="analysis">Análise</SelectItem>
                  <SelectItem value="metadata">Metadados</SelectItem>
                  <SelectItem value="logs">Logs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recurso</Label>
              {loadingResources ? (
                <p className="text-xs text-muted-foreground py-2">Carregando itens da usuária...</p>
              ) : userResources.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum item encontrado para este tipo.</p>
              ) : (
                <Select value={arResourceId} onValueChange={setArResourceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um item" /></SelectTrigger>
                  <SelectContent>
                    {userResources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Escopo</Label>
              <Select value={arScope} onValueChange={setArScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read_metadata">Metadados</SelectItem>
                  <SelectItem value="read_transcription">Transcrição</SelectItem>
                  <SelectItem value="read_audio_stream">Áudio (streaming)</SelectItem>
                  <SelectItem value="read_analysis">Análise</SelectItem>
                  <SelectItem value="read_logs">Logs técnicos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Justificativa (obrigatória)</Label>
              <Textarea
                placeholder="Descreva por que precisa acessar este recurso..."
                value={arJustification}
                onChange={(e) => setArJustification(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccessForm(false)}>Cancelar</Button>
            <Button onClick={handleRequestAccess} disabled={!arResourceId || !arJustification.trim() || requesting}>
              {requesting ? "Enviando..." : "Solicitar Acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Code Modal */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inserir Código de Consentimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Peça o código de 6 dígitos exibido no app da usuária e insira abaixo.
            </p>
            <Input
              placeholder="000000"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancelar</Button>
            <Button onClick={handleConfirmAccess} disabled={confirmCode.length !== 6}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GrantCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expirado"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span className="font-mono">{remaining}</span>;
}
