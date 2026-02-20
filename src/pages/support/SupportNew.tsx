import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, Loader2, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const [category, setCategory] = useState(preCategory || "app_issue");
  const [message, setMessage] = useState("");
  const [linkResource, setLinkResource] = useState(!!preResourceId);
  const [resourceType, setResourceType] = useState(preResourceType || "recording");
  const [resourceId, setResourceId] = useState(preResourceId);
  const [resourceLabel, setResourceLabel] = useState(preResourceLabel);
  const [recordings, setRecordings] = useState<RecordingOption[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [sending, setSending] = useState(false);

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

  const handleSubmit = async () => {
    if (!sessionToken) return;
    if (message.trim().length < 10) {
      toast.error("A mensagem deve ter pelo menos 10 caracteres.");
      return;
    }
    setSending(true);
    try {
      const payload: any = { category, message_text: message.trim() };
      if (linkResource && resourceId) {
        payload.linked_resource = {
          resource_type: resourceType,
          resource_id: resourceId,
          resource_label: resourceLabel || resourceId,
        };
      }
      const res = await callSupportApi("createUserSession", sessionToken, payload);
      if (res.ok && res.data?.data?.session_id) {
        toast.success("Chamado aberto com sucesso!");
        navigate(`/support/tickets/${res.data.data.session_id}`);
      } else {
        toast.error(res.data?.error || "Erro ao abrir chamado.");
      }
    } catch {
      toast.error("Erro ao abrir chamado. Tente novamente.");
    }
    setSending(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/support")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-display font-bold text-foreground">Novo Chamado</h1>
      </div>

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

          <Button onClick={handleSubmit} disabled={sending} className="w-full gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Enviando..." : "Abrir chamado"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
