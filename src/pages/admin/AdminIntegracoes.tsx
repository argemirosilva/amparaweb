import { useEffect, useState } from "react";
import { Save, RotateCcw, Plug, Mic, Brain, Phone } from "lucide-react";
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

const INTEGRATION_CATEGORIES = [
  {
    key: "integracao_agreggar",
    label: "Agreggar — Transcrição de Áudio",
    description: "Serviço de speech-to-text utilizado para transcrever gravações de monitoramento.",
    icon: Mic,
    color: "hsl(262 60% 50%)",
  },
  {
    key: "integracao_ia",
    label: "Análise de IA — Lovable AI Gateway",
    description: "Modelos de inteligência artificial para análise de risco e classificação de gravações.",
    icon: Brain,
    color: "hsl(224 76% 33%)",
  },
  {
    key: "integracao_elevenlabs",
    label: "ElevenLabs — Voz e Telefonia",
    description: "Agente de voz para comunicados ao COPOM via WebRTC e chamadas telefônicas.",
    icon: Phone,
    color: "hsl(150 60% 40%)",
  },
];

const FRIENDLY_LABELS: Record<string, string> = {
  agreggar_api_url: "URL da API",
  agreggar_ativa: "Integração ativa",
  ia_modelo_analise: "Modelo de análise",
  ia_modelo_risco: "Modelo de risco",
  ia_ativa: "Integração ativa",
  ia_prompt_analise: "Prompt de análise",
  elevenlabs_agent_id: "Agent ID",
  elevenlabs_ativa: "Integração ativa",
  elevenlabs_telefonia_ativa: "Telefonia ativa",
  elevenlabs_copom_telefone: "Telefone COPOM (destino)",
};

const TEXTAREA_KEYS = new Set(["ia_prompt_analise"]);

export default function AdminIntegracoes() {
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

  const inputStyle: React.CSSProperties = {
    border: "1px solid hsl(220 13% 91%)",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    outline: "none",
    fontFamily: "Inter, Roboto, sans-serif",
    color: "hsl(220 13% 18%)",
    width: "100%",
    maxWidth: 400,
  };

  function renderField(s: Setting) {
    const currentValue = editedValues[s.id] ?? s.valor;
    const isModified = editedValues[s.id] !== undefined && editedValues[s.id] !== s.valor;

    if (s.valor === "true" || s.valor === "false") {
      return (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleChange(s.id, currentValue === "true" ? "false" : "true")}
            className="relative w-10 h-5 rounded-full transition-colors shrink-0"
            style={{ background: currentValue === "true" ? "hsl(224 76% 33%)" : "hsl(220 13% 85%)" }}
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
              style={{ left: currentValue === "true" ? 22 : 2 }}
            />
          </button>
          <span className="text-xs" style={{ color: "hsl(220 13% 18%)" }}>
            {currentValue === "true" ? "Ativado" : "Desativado"}
          </span>
          {isModified && (
            <div className="flex gap-1 ml-auto">
              <button onClick={() => resetField(s.id)} className="p-1 rounded hover:bg-gray-100" title="Desfazer">
                <RotateCcw className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} />
              </button>
              <button onClick={() => handleSave(s)} disabled={saving === s.id} className="p-1 rounded hover:bg-gray-100" title="Salvar">
                <Save className="w-3.5 h-3.5" style={{ color: "hsl(224 76% 33%)" }} />
              </button>
            </div>
          )}
        </div>
      );
    }

    // Textarea for long text fields (prompts)
    if (TEXTAREA_KEYS.has(s.chave)) {
      const lineCount = currentValue.split("\n").length;
      return (
        <div className="flex flex-col gap-2">
          {/* Prompt editor header */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-t-md border border-b-0"
            style={{
              background: "hsl(220 20% 16%)",
              borderColor: "hsl(220 13% 30%)",
            }}
          >
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(0 70% 55%)" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(45 80% 55%)" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(130 50% 50%)" }} />
            </div>
            <span
              className="text-[10px] font-medium tracking-wider uppercase ml-2"
              style={{ color: "hsl(220 10% 60%)", fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace" }}
            >
              system_prompt.txt
            </span>
            <span
              className="ml-auto text-[10px]"
              style={{ color: "hsl(220 10% 50%)", fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace" }}
            >
              {lineCount} linhas · {currentValue.length} chars
            </span>
          </div>
          <textarea
            style={{
              border: "1px solid hsl(220 13% 30%)",
              borderTop: "none",
              borderRadius: "0 0 6px 6px",
              padding: "12px 16px",
              fontSize: 12.5,
              outline: "none",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
              color: "hsl(150 60% 80%)",
              background: "hsl(220 20% 12%)",
              width: "100%",
              minHeight: 280,
              maxHeight: 500,
              resize: "vertical",
              lineHeight: 1.7,
              tabSize: 2,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
            value={currentValue}
            onChange={(e) => handleChange(s.id, e.target.value)}
            spellCheck={false}
          />
          {isModified && (
            <div className="flex gap-2 justify-end">
              <button onClick={() => resetField(s.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs hover:bg-gray-100" title="Desfazer">
                <RotateCcw className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} /> Desfazer
              </button>
              <button
                onClick={() => handleSave(s)}
                disabled={saving === s.id}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-white"
                style={{ background: "hsl(224 76% 33%)" }}
              >
                <Save className="w-3.5 h-3.5" /> Salvar
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          style={inputStyle}
          value={currentValue}
          onChange={(e) => handleChange(s.id, e.target.value)}
        />
        {isModified && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => resetField(s.id)} className="p-1.5 rounded hover:bg-gray-100" title="Desfazer">
              <RotateCcw className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} />
            </button>
            <button onClick={() => handleSave(s)} disabled={saving === s.id} className="p-1.5 rounded hover:bg-gray-100" title="Salvar">
              <Save className="w-3.5 h-3.5" style={{ color: "hsl(224 76% 33%)" }} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={fontStyle}>
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Integrações</p>
        <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Integrações</h1>
        <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>
          Configure os serviços externos conectados ao sistema
        </p>
      </div>

      {loading ? (
        <div
          className="rounded-md border p-8 text-center"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Carregando integrações...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {INTEGRATION_CATEGORIES.map((cat) => {
            const items = settings.filter((s) => s.categoria === cat.key);
            if (items.length === 0) return null;

            const Icon = cat.icon;
            const activeItem = items.find((s) => s.chave.endsWith("_ativa"));
            const isActive = activeItem ? (editedValues[activeItem.id] ?? activeItem.valor) === "true" : true;

            return (
              <div
                key={cat.key}
                className="rounded-lg border overflow-hidden"
                style={{
                  background: "hsl(0 0% 100%)",
                  borderColor: isActive ? "hsl(220 13% 91%)" : "hsl(220 13% 91% / 0.6)",
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                {/* Header */}
                <div
                  className="px-4 py-3 border-b flex items-center gap-3"
                  style={{ borderColor: "hsl(220 13% 91%)", background: "hsl(210 17% 98%)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${cat.color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: cat.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
                      {cat.label}
                    </h2>
                    <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                      {cat.description}
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      background: isActive ? "hsl(150 60% 40% / 0.1)" : "hsl(0 0% 80% / 0.2)",
                      color: isActive ? "hsl(150 60% 35%)" : "hsl(220 9% 46%)",
                    }}
                  >
                    {isActive ? "ATIVA" : "INATIVA"}
                  </span>
                </div>

                {/* Fields */}
                <div className="divide-y" style={{ borderColor: "hsl(220 13% 91%)" }}>
                  {items.map((s) => {
                    const isTextarea = TEXTAREA_KEYS.has(s.chave);
                    return (
                      <div key={s.id} className={`px-4 py-3.5 ${isTextarea ? "flex flex-col gap-2" : "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6"}`}>
                        <div className={isTextarea ? "" : "flex-1 min-w-0"}>
                          <p className="text-sm font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                            {FRIENDLY_LABELS[s.chave] || s.chave.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </p>
                          {s.descricao && (
                            <p className="text-xs mt-0.5" style={{ color: "hsl(220 9% 46%)" }}>
                              {s.descricao}
                            </p>
                          )}
                        </div>
                        <div className={isTextarea ? "w-full" : "sm:w-96 shrink-0"}>{renderField(s)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
