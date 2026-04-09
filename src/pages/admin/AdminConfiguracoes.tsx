import { useEffect, useState, useRef } from "react";
import { Settings, Save, RotateCcw, Plus, X, ChevronDown, ChevronRight, Tags, AlertTriangle, BrainCircuit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminTiposAlerta from "./AdminTiposAlerta";
import AdminPalavrasTriagem from "./AdminPalavrasTriagem";
import AdminPromptsIA from "@/components/admin/AdminPromptsIA";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callAdminApi(action: string, sessionToken: string, params: Record<string, any> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ action, session_token: sessionToken, ...params }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

interface Setting {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  categoria: string;
  updated_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  dados: "Dados e Retenção",
  limites: "Limites do Sistema",
  panico: "Alerta de Pânico",
  gps: "GPS e Localização",
  notificacoes: "Notificações",
  sistema: "Sistema",
};

const FRIENDLY_LABELS: Record<string, string> = {
  elevenlabs_copom_telefone: "Telefones chamada de emergência 190/180",
  copom_telefone_destino: "Telefones chamada de emergência 190/180",
};

const FIELD_HINTS: Record<string, string> = {};
const PHONE_CHIP_KEYS = new Set(["elevenlabs_copom_telefone", "copom_telefone_destino"]);
const HIDDEN_KEYS = new Set(["ia_prompt_analise", "ia_prompt_triagem", "ia_prompt_macro"]);
const CATEGORY_ORDER = ["sistema", "panico", "gps", "notificacoes", "dados", "limites"];

export default function AdminConfiguracoes() {
  const { sessionToken } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [tiposOpen, setTiposOpen] = useState(false);
  const [triagemOpen, setTriagemOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);

  async function loadSettings() {
    if (!sessionToken) return;
    setLoading(true);
    const { ok, data } = await callAdminApi("listSettings", sessionToken);
    if (ok) setSettings(data.settings || []);
    else toast.error(data.error || "Erro ao carregar configurações");
    setEditedValues({});
    setLoading(false);
  }

  useEffect(() => { loadSettings(); }, [sessionToken]);

  function handleChange(id: string, value: string) {
    setEditedValues((prev) => ({ ...prev, [id]: value }));
  }

  function resetField(id: string) {
    setEditedValues((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
  }

  async function handleSave(setting: Setting) {
    if (!sessionToken) return;
    const newValue = editedValues[setting.id];
    if (newValue === undefined || newValue === setting.valor) return;
    setSaving(setting.id);
    const { ok, data } = await callAdminApi("updateSetting", sessionToken, { id: setting.id, valor: newValue });
    setSaving(null);
    if (ok) { toast.success("Configuração atualizada"); loadSettings(); }
    else toast.error(data.error || "Erro ao salvar");
  }

  const grouped = CATEGORY_ORDER
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      items: settings.filter((s) => s.categoria === cat && !HIDDEN_KEYS.has(s.chave)),
    }))
    .filter((g) => g.items.length > 0);

  function PhoneChipField({ setting }: { setting: Setting }) {
    const currentValue = editedValues[setting.id] ?? setting.valor;
    const phones = currentValue.split(",").map((p) => p.trim()).filter(Boolean);
    const [newPhone, setNewPhone] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const isModified = editedValues[setting.id] !== undefined && editedValues[setting.id] !== setting.valor;

    function updatePhones(list: string[]) { handleChange(setting.id, list.join(", ")); }
    function addPhone() {
      const cleaned = newPhone.replace(/\D/g, "");
      if (cleaned.length >= 10 && !phones.includes(cleaned)) {
        updatePhones([...phones, cleaned]);
        setNewPhone("");
        inputRef.current?.focus();
      }
    }
    function removePhone(idx: number) { updatePhones(phones.filter((_, i) => i !== idx)); }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {phones.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {p}
              <button onClick={() => removePhone(i)} className="hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="tel" className="text-sm rounded-md border border-border px-3 py-2 outline-none bg-background text-foreground w-[180px]" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="11999998888" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhone(); } }} />
          <button onClick={addPhone} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
        {isModified && (
          <div className="flex gap-1">
            <button onClick={() => resetField(setting.id)} className="p-1.5 rounded hover:bg-muted" title="Desfazer"><RotateCcw className="w-3.5 h-3.5 text-muted-foreground" /></button>
            <button onClick={() => handleSave(setting)} disabled={saving === setting.id} className="p-1.5 rounded hover:bg-muted" title="Salvar"><Save className="w-3.5 h-3.5 text-primary" /></button>
          </div>
        )}
      </div>
    );
  }

  function renderInput(s: Setting) {
    const currentValue = editedValues[s.id] ?? s.valor;
    const isModified = editedValues[s.id] !== undefined && editedValues[s.id] !== s.valor;

    if (PHONE_CHIP_KEYS.has(s.chave)) return <PhoneChipField setting={s} />;

    if (s.valor === "true" || s.valor === "false") {
      return (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleChange(s.id, currentValue === "true" ? "false" : "true")}
            className="relative w-10 h-5 rounded-full transition-colors shrink-0"
            style={{ background: currentValue === "true" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)" }}
          >
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ left: currentValue === "true" ? 22 : 2 }} />
          </button>
          <span className="text-xs text-foreground">{currentValue === "true" ? "Ativado" : "Desativado"}</span>
          {isModified && (
            <div className="flex gap-1 ml-auto">
              <button onClick={() => resetField(s.id)} className="p-1 rounded hover:bg-muted" title="Desfazer"><RotateCcw className="w-3.5 h-3.5 text-muted-foreground" /></button>
              <button onClick={() => handleSave(s)} className="p-1 rounded hover:bg-muted" title="Salvar"><Save className="w-3.5 h-3.5 text-primary" /></button>
            </div>
          )}
        </div>
      );
    }

    const isNumber = !isNaN(Number(s.valor));
    const hint = FIELD_HINTS[s.chave];

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            type={isNumber ? "number" : "text"}
            className="text-sm rounded-md border border-border px-3 py-2 outline-none bg-background text-foreground"
            style={{ width: isNumber ? 120 : "100%", maxWidth: 300 }}
            value={currentValue}
            onChange={(e) => handleChange(s.id, e.target.value)}
          />
          {isModified && (
            <div className="flex gap-1">
              <button onClick={() => resetField(s.id)} className="p-1.5 rounded hover:bg-muted" title="Desfazer"><RotateCcw className="w-3.5 h-3.5 text-muted-foreground" /></button>
              <button onClick={() => handleSave(s)} disabled={saving === s.id} className="p-1.5 rounded hover:bg-muted" title="Salvar"><Save className="w-3.5 h-3.5 text-primary" /></button>
            </div>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        icon={Settings}
        breadcrumb="Admin › Configurações"
        title="Configurações do Sistema"
        description="Parâmetros globais que afetam o comportamento do sistema"
      />

      {loading ? (
        <div className="rounded-lg border border-border bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Carregando configurações...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.category} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/50">
                <Settings className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
              </div>
              <div className="divide-y divide-border">
                {group.items.map((s) => (
                  <div key={s.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {FRIENDLY_LABELS[s.chave] || s.chave.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                      {s.descricao && <p className="text-xs mt-0.5 text-muted-foreground">{s.descricao}</p>}
                    </div>
                    <div className="sm:w-80 shrink-0">{renderInput(s)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tipos de Alerta - Collapsible */}
      <div className="mt-8 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setTiposOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center gap-2 bg-muted/50 hover:bg-muted/70 transition-colors text-left"
        >
          <Tags className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground flex-1">Tipos de Alerta</h2>
          <span className="text-xs text-muted-foreground mr-2">Taxonomia usada nos prompts de IA, curadoria e análises</span>
          {tiposOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        {tiposOpen && (
          <div className="p-4">
            <AdminTiposAlerta />
          </div>
        )}
      </div>
      {/* Palavras de Triagem - Collapsible */}
      <div className="mt-4 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setTriagemOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center gap-2 bg-muted/50 hover:bg-muted/70 transition-colors text-left"
        >
          <AlertTriangle className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground flex-1">Palavras de Triagem</h2>
          <span className="text-xs text-muted-foreground mr-2">Keywords de risco para triagem rápida de segmentos</span>
          {triagemOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        {triagemOpen && (
          <div className="p-4">
            <AdminPalavrasTriagem />
          </div>
        )}
      </div>
      {/* Prompts de IA - Collapsible */}
      <div className="mt-4 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <button
          onClick={() => setPromptsOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center gap-2 bg-muted/50 hover:bg-muted/70 transition-colors text-left"
        >
          <BrainCircuit className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground flex-1">Prompts de IA</h2>
          <span className="text-xs text-muted-foreground mr-2">Configurar os 3 prompts de análise (Triagem, MICRO, MACRO)</span>
          {promptsOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        {promptsOpen && (
          <div className="p-4">
            <AdminPromptsIA />
          </div>
        )}
      </div>
    </div>
  );
}
