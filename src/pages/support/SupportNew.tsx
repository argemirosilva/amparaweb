import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Link2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { callSupportApi } from "@/services/supportApiService";
import { callWebApi } from "@/services/webApiService";

const CATEGORIES = [
  { value: "app_issue", label: "Problema no app" },
  { value: "playback", label: "Reprodução de áudio" },
  { value: "upload", label: "Upload de áudio" },
  { value: "gps", label: "GPS / Localização" },
  { value: "notifications", label: "Notificações" },
  { value: "account", label: "Conta / Acesso" },
  { value: "recording_question", label: "Dúvida sobre gravação" },
  { value: "transcription_question", label: "Dúvida sobre transcrição" },
  { value: "analysis_question", label: "Dúvida sobre análise" },
  { value: "other", label: "Outro" },
];

interface RecordingOption {
  id: string;
  label: string;
}

export default function SupportNew() {
  const { sessionToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const preCategory = searchParams.get("category") || "";
  const preResourceType = searchParams.get("resource_type") || "";
  const preResourceId = searchParams.get("resource_id") || "";
  const preResourceLabel = searchParams.get("resource_label") || "";

  // Stage: "form" | "otp"
  const [stage, setStage] = useState<"form" | "otp">("form");

  // Form state
  const [category, setCategory] = useState(preCategory || "app_issue");
  const [message, setMessage] = useState("");
  const [linkResource, setLinkResource] = useState(!!preResourceId);
  const [resourceType, setResourceType] = useState(preResourceType || "recording");
  const [resourceId, setResourceId] = useState(preResourceId);
  const [resourceLabel, setResourceLabel] = useState(preResourceLabel);
  const [recordings, setRecordings] = useState<RecordingOption[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [sending, setSending] = useState(false);

  // OTP state
  const [otpCode, setOtpCode] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const loadRecordings = useCallback(async () => {
    if (!sessionToken) return;
    setLoadingRecordings(true);
    try {
      const res = await callWebApi("getGravacoes", sessionToken, { page: 1, per_page: 50 });
      if (res.ok && res.data?.gravacoes) {
        setRecordings(
          res.data.gravacoes.map((g: any) => ({
            id: g.id,
            label: `Gravação ${new Date(g.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${new Date(g.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${g.duracao_segundos ? Math.floor(g.duracao_segundos / 60) + ":" + String(Math.floor(g.duracao_segundos % 60)).padStart(2, "0") : "—"})`,
          }))
        );
      }
    } catch { /* ignore */ }
    setLoadingRecordings(false);
  }, [sessionToken]);

  useEffect(() => {
    if (linkResource && !preResourceId) loadRecordings();
  }, [linkResource, preResourceId, loadRecordings]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestVerification = async () => {
    if (!sessionToken) return;
    if (message.trim().length < 10) {
      toast.error("A mensagem deve ter pelo menos 10 caracteres.");
      return;
    }
    setSending(true);
    try {
      const res = await callSupportApi("requestSupportVerification", sessionToken, {
        category,
        message_text: message.trim(),
        linked_resource: linkResource && resourceId ? {
          resource_type: resourceType,
          resource_id: resourceId,
          resource_label: resourceLabel || resourceId,
        } : undefined,
      });
      if (res.ok && res.data?.data?.masked_phone) {
        setMaskedPhone(res.data.data.masked_phone);
        setStage("otp");
        setResendCooldown(60);
        toast.success("Código enviado via WhatsApp!");
      } else {
        toast.error(res.data?.error || "Erro ao solicitar verificação.");
      }
    } catch {
      toast.error("Erro ao solicitar verificação. Tente novamente.");
    }
    setSending(false);
  };

  const handleVerifyCode = async () => {
    if (!sessionToken) return;
    if (otpCode.length !== 6) {
      toast.error("Digite o código completo de 6 dígitos.");
      return;
    }
    setVerifying(true);
    try {
      const res = await callSupportApi("verifySupportCode", sessionToken, {
        code: otpCode,
        category,
        message_text: message.trim(),
        linked_resource: linkResource && resourceId ? {
          resource_type: resourceType,
          resource_id: resourceId,
          resource_label: resourceLabel || resourceId,
        } : undefined,
      });

      if (res.status === 401 && res.data?.session_killed) {
        // Session killed — the AuthContext listener will handle logout
        toast.error("Sessão encerrada por segurança. Faça login novamente.");
        window.dispatchEvent(new Event("ampara:session_expired"));
        return;
      }

      if (res.ok && res.data?.data?.session_id) {
        toast.success("Chamado aberto com sucesso!");
        navigate(`/support/tickets/${res.data.data.session_id}`);
      } else {
        toast.error(res.data?.error || "Código inválido.");
        setOtpCode("");
      }
    } catch {
      toast.error("Erro ao verificar código. Tente novamente.");
    }
    setVerifying(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !sessionToken) return;
    setSending(true);
    try {
      const res = await callSupportApi("requestSupportVerification", sessionToken, {
        category,
        message_text: message.trim(),
      });
      if (res.ok) {
        toast.success("Novo código enviado!");
        setResendCooldown(60);
        setOtpCode("");
      } else {
        toast.error(res.data?.error || "Erro ao reenviar código.");
      }
    } catch {
      toast.error("Erro ao reenviar código.");
    }
    setSending(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => stage === "otp" ? setStage("form") : navigate("/support")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-display font-bold text-foreground">
          {stage === "otp" ? "Verificação de Identidade" : "Novo Chamado"}
        </h1>
      </div>

      {stage === "form" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Descreva seu problema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category */}
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Link resource toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="link-toggle" className="flex items-center gap-2 cursor-pointer">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                Vincular a um item
              </Label>
              <Switch
                id="link-toggle"
                checked={linkResource}
                onCheckedChange={setLinkResource}
                disabled={!!preResourceId}
              />
            </div>

            {linkResource && (
              <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                <div className="space-y-1.5">
                  <Label>Tipo do recurso</Label>
                  <Select value={resourceType} onValueChange={setResourceType} disabled={!!preResourceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recording">Gravação</SelectItem>
                      <SelectItem value="transcription">Transcrição</SelectItem>
                      <SelectItem value="analysis">Análise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {preResourceId ? (
                  <div className="text-sm text-muted-foreground">
                    📎 {preResourceLabel || preResourceId}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Selecionar item</Label>
                    {loadingRecordings ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                      </div>
                    ) : recordings.length > 0 ? (
                      <Select value={resourceId} onValueChange={(val) => {
                        setResourceId(val);
                        const found = recordings.find((r) => r.id === val);
                        setResourceLabel(found?.label || val);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {recordings.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Message */}
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                placeholder="Descreva o problema com o máximo de detalhes possível..."
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
            </div>

            <Button onClick={handleRequestVerification} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {sending ? "Enviando código..." : "Verificar identidade e abrir chamado"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Um código de verificação será enviado para seu WhatsApp cadastrado.
            </p>
          </CardContent>
        </Card>
      )}

      {stage === "otp" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Código de Verificação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Enviamos um código de 6 dígitos para o WhatsApp:</p>
              <p className="font-medium text-foreground">{maskedPhone}</p>
              <p className="text-xs">O código expira em 5 minutos.</p>
            </div>

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={setOtpCode}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button onClick={handleVerifyCode} disabled={verifying || otpCode.length !== 6} className="w-full gap-2">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {verifying ? "Verificando..." : "Confirmar e abrir chamado"}
            </Button>

            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                disabled={resendCooldown > 0 || sending}
                onClick={handleResend}
                className="text-xs"
              >
                {resendCooldown > 0
                  ? `Reenviar código em ${resendCooldown}s`
                  : "Reenviar código"}
              </Button>
            </div>

            <p className="text-xs text-destructive/80 text-center">
              ⚠️ Após 2 tentativas incorretas, sua sessão será encerrada por segurança.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
