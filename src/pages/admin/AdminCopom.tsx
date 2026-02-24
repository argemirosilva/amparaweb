import { useState, useEffect } from "react";
import { Phone, Send, History, Plus, X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callApi(action: string, sessionToken: string, params: Record<string, any> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/agreggar-speed-dial`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ action, session_token: sessionToken, ...params }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

interface ExtraField {
  fieldName: string;
  value: string;
}

interface HistoryItem {
  id: string;
  created_at: string;
  payload: any;
  resposta: any;
  sucesso: boolean | null;
}

export default function AdminCopom() {
  const { sessionToken } = useAuth();
  const [tab, setTab] = useState<"dial" | "history">("dial");

  // Form state
  const [campaignId, setCampaignId] = useState("1506");
  const [contactName, setContactName] = useState("");
  const [ddd, setDdd] = useState("");
  const [phone, setPhone] = useState("");
  const [extraFields, setExtraFields] = useState<ExtraField[]>([
    { fieldName: "NOME_AGRESSOR", value: "" },
  ]);
  const [sending, setSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  function addExtraField() {
    setExtraFields((prev) => [...prev, { fieldName: "", value: "" }]);
  }

  function removeExtraField(idx: number) {
    setExtraFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateExtraField(idx: number, key: keyof ExtraField, val: string) {
    setExtraFields((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: val } : f)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    if (!contactName || !ddd || !phone) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSending(true);
    setLastResponse(null);

    const { ok, data } = await callApi("speedDial", sessionToken, {
      campaignId,
      contactName,
      ddd,
      phone,
      extraFields: extraFields.filter((f) => f.fieldName && f.value),
    });

    setSending(false);
    setLastResponse(data);

    if (ok) {
      toast.success("SpeedDial disparado com sucesso");
    } else {
      toast.error(data.error || "Erro ao disparar speedDial");
    }
  }

  async function loadHistory() {
    if (!sessionToken) return;
    setLoadingHistory(true);
    const { ok, data } = await callApi("listHistory", sessionToken);
    if (ok) setHistory(data.history || []);
    setLoadingHistory(false);
  }

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, sessionToken]);

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <AdminPageHeader
        icon={Phone}
        breadcrumb="Admin › COPOM Agreggar"
        title="COPOM — Agreggar SpeedDial"
        description="Dispare chamadas automatizadas via plataforma OCS Agreggar"
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        <button
          onClick={() => setTab("dial")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "dial"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Send className="w-4 h-4" /> SpeedDial
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "history"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <History className="w-4 h-4" /> Histórico
        </button>
      </div>

      {tab === "dial" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-border bg-card shadow-sm p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-foreground">Dados da Chamada</h3>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Campaign ID *
              </label>
              <input
                className={inputClass}
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                placeholder="1506"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Nome do Contato *
              </label>
              <input
                className={inputClass}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nome da vítima"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  DDD *
                </label>
                <input
                  className={inputClass}
                  value={ddd}
                  onChange={(e) => setDdd(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="14"
                  maxLength={2}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Telefone *
                </label>
                <input
                  className={inputClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="996005332"
                  maxLength={9}
                />
              </div>
            </div>

            {/* Extra fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Campos Extras (lstExtraFieldValue)
                </label>
                <button
                  type="button"
                  onClick={addExtraField}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {extraFields.map((f, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className={inputClass}
                      value={f.fieldName}
                      onChange={(e) => updateExtraField(i, "fieldName", e.target.value)}
                      placeholder="fieldName"
                    />
                    <input
                      className={inputClass}
                      value={f.value}
                      onChange={(e) => updateExtraField(i, "value", e.target.value)}
                      placeholder="value"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraField(i)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-destructive shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold ampara-gradient-bg text-primary-foreground disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Phone className="w-4 h-4" />
              )}
              {sending ? "Enviando..." : "Disparar SpeedDial"}
            </button>
          </form>

          {/* Response / Preview */}
          <div className="rounded-lg border border-border bg-card shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Payload de Envio</h3>
            <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-48 text-foreground">
              {JSON.stringify(
                {
                  campaignId: Number(campaignId),
                  contactName,
                  ddd,
                  phone,
                  lstExtraFieldValue: extraFields.filter((f) => f.fieldName && f.value),
                },
                null,
                2
              )}
            </pre>

            {lastResponse && (
              <>
                <h3 className="text-sm font-semibold text-foreground">Resposta</h3>
                <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-64 text-foreground">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          {loadingHistory ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum disparo registrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                      Data/Hora
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                      Contato
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                      Telefone
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                      Campaign
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((h) => {
                    const p = h.payload || {};
                    return (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-foreground">{p.contactName || "—"}</td>
                        <td className="px-4 py-3 text-foreground font-mono">
                          ({p.ddd}) {p.phone}
                        </td>
                        <td className="px-4 py-3 text-foreground">{p.campaignId}</td>
                        <td className="px-4 py-3">
                          <Badge variant={h.sucesso ? "default" : "destructive"}>
                            {h.sucesso ? "Sucesso" : "Erro"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
