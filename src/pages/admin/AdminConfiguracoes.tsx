import { useEffect, useState } from "react";
import { Settings, Save, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

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
};

const FIELD_HINTS: Record<string, string> = {
  elevenlabs_copom_telefone: "Separe múltiplos telefones por vírgula. Ex: 11999998888, 21988887777",
};

const TEXTAREA_KEYS = new Set(["elevenlabs_copom_telefone"]);

const CATEGORY_ORDER = ["sistema", "panico", "gps", "notificacoes", "dados", "limites"];

export default function AdminConfiguracoes() {
  const { sessionToken } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function loadSettings() {
    if (!sessionToken) return;
    setLoading(true);
    const { ok, data } = await callAdminApi("listSettings", sessionToken);
    if (ok) setSettings(data.settings || []);
    else toast.error(data.error || "Erro ao carregar configurações");
    setEditedValues({});
    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, [sessionToken]);

  function handleChange(id: string, value: string) {
    setEditedValues((prev) => ({ ...prev, [id]: value }));
  }

  function resetField(id: string) {
    setEditedValues((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  async function handleSave(setting: Setting) {
    if (!sessionToken) return;
    const newValue = editedValues[setting.id];
    if (newValue === undefined || newValue === setting.valor) return;

    setSaving(setting.id);
    const { ok, data } = await callAdminApi("updateSetting", sessionToken, {
      id: setting.id,
      valor: newValue,
    });
    setSaving(null);

    if (ok) {
      toast.success("Configuração atualizada");
      loadSettings();
    } else {
      toast.error(data.error || "Erro ao salvar");
    }
  }

  const grouped = CATEGORY_ORDER
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      items: settings.filter((s) => s.categoria === cat),
    }))
    .filter((g) => g.items.length > 0);

  const inputStyle = {
    border: "1px solid hsl(220 13% 91%)",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    outline: "none",
    fontFamily: "Inter, Roboto, sans-serif",
    color: "hsl(220 13% 18%)",
  };

  function renderInput(s: Setting) {
    const currentValue = editedValues[s.id] ?? s.valor;
    const isModified = editedValues[s.id] !== undefined && editedValues[s.id] !== s.valor;

    if (s.valor === "true" || s.valor === "false") {
      return (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleChange(s.id, currentValue === "true" ? "false" : "true")}
            className="relative w-10 h-5 rounded-full transition-colors"
            style={{ background: currentValue === "true" ? "hsl(224 76% 33%)" : "hsl(220 13% 85%)" }}
          >
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ left: currentValue === "true" ? 22 : 2 }} />
          </button>
          <span className="text-xs" style={{ color: "hsl(220 13% 18%)" }}>
            {currentValue === "true" ? "Ativado" : "Desativado"}
          </span>
          {isModified && (
            <div className="flex gap-1 ml-auto">
              <button onClick={() => resetField(s.id)} className="p-1 rounded hover:bg-gray-100" title="Desfazer"><RotateCcw className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} /></button>
              <button onClick={() => handleSave(s)} className="p-1 rounded hover:bg-gray-100" title="Salvar"><Save className="w-3.5 h-3.5" style={{ color: "hsl(224 76% 33%)" }} /></button>
            </div>
          )}
        </div>
      );
    }

    const isTextarea = TEXTAREA_KEYS.has(s.chave);
    const isNumber = !isTextarea && !isNaN(Number(s.valor));
    const hint = FIELD_HINTS[s.chave];

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {isTextarea ? (
            <textarea
              style={{ ...inputStyle, width: "100%", maxWidth: 340, minHeight: 56, resize: "vertical", fontSize: 13 }}
              value={currentValue}
              onChange={(e) => handleChange(s.id, e.target.value)}
              placeholder="11999998888, 21988887777"
            />
          ) : (
            <input
              type={isNumber ? "number" : "text"}
              style={{ ...inputStyle, width: isNumber ? 120 : "100%", maxWidth: 300 }}
              value={currentValue}
              onChange={(e) => handleChange(s.id, e.target.value)}
            />
          )}
          {isModified && (
            <div className="flex gap-1">
              <button onClick={() => resetField(s.id)} className="p-1.5 rounded hover:bg-gray-100" title="Desfazer"><RotateCcw className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} /></button>
              <button onClick={() => handleSave(s)} disabled={saving === s.id} className="p-1.5 rounded hover:bg-gray-100" title="Salvar"><Save className="w-3.5 h-3.5" style={{ color: "hsl(224 76% 33%)" }} /></button>
            </div>
          )}
        </div>
        {hint && <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>{hint}</p>}
      </div>
    );
  }

  return (
    <div style={fontStyle}>
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Configurações</p>
        <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Configurações do Sistema</h1>
        <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Parâmetros globais que afetam o comportamento do sistema</p>
      </div>

      {loading ? (
        <div className="rounded-md border p-8 text-center" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
          <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Carregando configurações...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.category} className="rounded-md border overflow-hidden" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "hsl(220 13% 91%)", background: "hsl(210 17% 98%)" }}>
                <Settings className="w-4 h-4" style={{ color: "hsl(224 76% 33%)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{group.label}</h2>
              </div>
              <div className="divide-y" style={{ borderColor: "hsl(220 13% 91%)" }}>
                {group.items.map((s) => (
                  <div key={s.id} className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                        {FRIENDLY_LABELS[s.chave] || s.chave.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </p>
                      {s.descricao && <p className="text-xs mt-0.5" style={{ color: "hsl(220 9% 46%)" }}>{s.descricao}</p>}
                    </div>
                    <div className="sm:w-80 shrink-0">{renderInput(s)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
