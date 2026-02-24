import { useState, useEffect } from "react";
import { Phone, Send, History, Plus, X, Loader2, ChevronDown, ChevronRight } from "lucide-react";
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

// Context fields matching ElevenLabs dynamic variables
interface ContextFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: "toggle";
}

const CONTEXT_FIELDS: Array<{ section: string; fields: ContextFieldDef[] }> = [
  { section: "Vítima", fields: [
    { key: "victim.name", label: "Nome da vítima", placeholder: "Maria Silva" },
    { key: "victim.phone_masked", label: "Telefone (mascarado)", placeholder: "(14) 9****-5332" },
  ]},
  { section: "Agressor", fields: [
    { key: "aggressor.name", label: "Nome do agressor", placeholder: "João Souza" },
    { key: "victim_aggressor_relation", label: "Relação com a vítima", placeholder: "ex-companheiro" },
    { key: "aggressor.tem_arma", label: "Possui arma?", type: "toggle" },
    { key: "aggressor.forca_seguranca", label: "Força de segurança?", type: "toggle" },
    { key: "aggressor.forca_seguranca_tipo", label: "Tipo força segurança", placeholder: "PM" },
    { key: "aggressor.vehicle.model", label: "Veículo — modelo", placeholder: "Gol Branco" },
    { key: "aggressor.vehicle.color", label: "Veículo — cor", placeholder: "Branco" },
    { key: "aggressor.vehicle.plate_partial", label: "Veículo — placa parcial", placeholder: "ABC-1*34" },
  ]},
  { section: "Localização", fields: [
    { key: "location.address", label: "Endereço (última localização)", placeholder: "Rua XV de Novembro, 123, Bauru-SP" },
    { key: "location.movement_status", label: "Status de movimento", placeholder: "parada" },
    { key: "monitoring_link", label: "Link de monitoramento", placeholder: "https://amparamulher.com.br/abc123" },
  ]},
];

function setNestedValue(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export default function AdminCopom({ embedded }: { embedded?: boolean }) {
  const { sessionToken } = useAuth();
  const [tab, setTab] = useState<"dial" | "history">("dial");

  // Form state
  const [campaignId, setCampaignId] = useState("1506");
  const [contactName, setContactName] = useState("Maria Silva");
  const [ddd, setDdd] = useState("14");
  const [phone, setPhone] = useState("996005332");
  const [context, setContext] = useState<Record<string, any>>({
    victim: { name: "Maria Silva", phone_masked: "(14) 99600-5332" },
    aggressor: {
      name: "João Souza",
      tem_arma: false,
      forca_seguranca: false,
      forca_seguranca_tipo: "",
      vehicle: { model: "Gol", color: "Prata", plate_partial: "FGH-3D45" },
    },
    victim_aggressor_relation: "ex-companheiro",
    location: { address: "Rua XV de Novembro, 250 - Centro", movement_status: "parada" },
    monitoring_link: "https://amparamulher.com.br/abc123",
  });
  const [extraFields, setExtraFields] = useState<ExtraField[]>([
    { fieldName: "VITIMA_NOME", value: "Maria Silva" },
    { fieldName: "VITIMA_TELEFONE", value: "(14) 99600-5332" },
    { fieldName: "AGRESSOR_NOME", value: "João Souza" },
    { fieldName: "RELACAO", value: "ex-companheiro" },
    { fieldName: "ENDERECO_ULTIMA_LOCALIZACAO", value: "Rua XV de Novembro, 250 - Centro" },
    { fieldName: "STATUS_MOVIMENTO", value: "parada" },
    { fieldName: "LINK_MONITORAMENTO", value: "amparamulher.com.br/abc123" },
    { fieldName: "AGRESSOR_TEM_ARMA", value: "não" },
    { fieldName: "AGRESSOR_FORCA_SEGURANCA", value: "não" },
    { fieldName: "VEICULO", value: "Gol, cor Prata, placa FGH-3D45" },
  ]);
  const [showExtras, setShowExtras] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  function updateContext(path: string, value: any) {
    setContext((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      setNestedValue(next, path, value);
      return next;
    });
  }

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
      context: Object.keys(context).length > 0 ? context : undefined,
      extraFields: extraFields.filter((f) => f.fieldName && f.value),
    });

    setSending(false);
    setLastResponse(data);

    if (ok) toast.success("SpeedDial disparado com sucesso");
    else toast.error(data.error || "Erro ao disparar speedDial");
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
      {!embedded && (
        <AdminPageHeader
          icon={Phone}
          breadcrumb="Admin › COPOM Agreggar"
          title="COPOM — Agreggar SpeedDial"
          description="Dispare chamadas automatizadas via plataforma OCS Agreggar"
        />
      )}

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
            className="rounded-lg border border-border bg-card shadow-sm p-5 space-y-5"
          >
            {/* Basic fields */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Dados da Chamada</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Campaign ID *</label>
                  <input className={inputClass} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="1506" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Contato *</label>
                  <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome da vítima" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">DDD *</label>
                    <input className={inputClass} value={ddd} onChange={(e) => setDdd(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="14" maxLength={2} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone *</label>
                    <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="996005332" maxLength={9} />
                  </div>
                </div>
              </div>
            </div>

            {/* Context fields — auto-mapped to ElevenLabs vars */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Contexto da Ocorrência</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Preenchidos automaticamente como lstExtraFieldValue (mesmas variáveis do ElevenLabs)
              </p>

              {CONTEXT_FIELDS.map((section) => (
                <div key={section.section} className="mb-4">
                  <p className="text-xs font-semibold text-primary mb-2">{section.section}</p>
                  <div className="space-y-2">
                    {section.fields.map((field) => {
                      if (field.type === "toggle") {
                        const val = !!getNestedValue(context, field.key);
                        return (
                          <div key={field.key} className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => updateContext(field.key, !val)}
                              className="relative w-10 h-5 rounded-full transition-colors shrink-0"
                              style={{ background: val ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)" }}
                            >
                              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ left: val ? 22 : 2 }} />
                            </button>
                            <span className="text-xs text-foreground">{field.label}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={field.key}>
                          <label className="text-xs text-muted-foreground mb-0.5 block">{field.label}</label>
                          <input
                            className={inputClass}
                            value={getNestedValue(context, field.key) || ""}
                            onChange={(e) => updateContext(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Manual extra fields (override) */}
            <div>
              <button
                type="button"
                onClick={() => setShowExtras(!showExtras)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {showExtras ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Campos extras manuais (override)
              </button>
              {showExtras && (
                <div className="mt-2 space-y-2">
                  {extraFields.map((f, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className={inputClass} value={f.fieldName} onChange={(e) => updateExtraField(i, "fieldName", e.target.value)} placeholder="fieldName" />
                      <input className={inputClass} value={f.value} onChange={(e) => updateExtraField(i, "value", e.target.value)} placeholder="value" />
                      <button type="button" onClick={() => removeExtraField(i)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addExtraField} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="w-3 h-3" /> Adicionar campo
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold ampara-gradient-bg text-primary-foreground disabled:opacity-60"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {sending ? "Enviando..." : "Disparar SpeedDial"}
            </button>
          </form>

          {/* Response / Preview */}
          <div className="rounded-lg border border-border bg-card shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Payload de Envio</h3>
            <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-64 text-foreground">
              {JSON.stringify(
                {
                  campaignId: Number(campaignId),
                  contactName,
                  ddd,
                  phone,
                  context: Object.keys(context).length > 0 ? context : undefined,
                  extraFields: extraFields.filter((f) => f.fieldName && f.value),
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
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Data/Hora</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Contato</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Telefone</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Campaign</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((h) => {
                    const p = h.payload || {};
                    return (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 text-foreground">{p.contactName || "—"}</td>
                        <td className="px-4 py-3 text-foreground font-mono">({p.ddd}) {p.phone}</td>
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
