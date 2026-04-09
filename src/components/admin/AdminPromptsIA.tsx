import { useState, useEffect } from "react";
import { Save, RotateCcw, BrainCircuit, Zap, FileText, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callAdminApi(action: string, sessionToken: string, params: Record<string, any> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ action, session_token: sessionToken, ...params }),
  });
  return { ok: res.ok, data: await res.json() };
}

interface PromptConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  placeholder: string;
}

const PROMPTS: PromptConfig[] = [
  {
    key: "ia_prompt_triagem",
    label: "Triagem Rápida",
    description: "Prompt leve e rápido para classificar risco (seguro/moderado/alto/critico) antes da análise completa. Usa modelo Flash-Lite para máxima velocidade.",
    icon: Zap,
    placeholder: `Analise a transcrição abaixo e classifique o nível de risco.\nRetorne APENAS JSON: {"resultado":"seguro|moderado|alto|critico","motivo":"justificativa curta"}\n\nRegras:\n- "seguro": silêncio, assunto cotidiano, sem indicadores de risco\n- "moderado": tensão verbal, mas sem ameaça direta\n- "alto": ameaças, gritos intensos, agressão verbal grave\n- "critico": violência iminente, pedidos de socorro, menção a armas`,
  },
  {
    key: "ia_prompt_analise",
    label: "Análise MICRO (Individual)",
    description: "Prompt completo para análise individual de cada gravação/conversa. Identifica tipos de violência, táticas manipulativas, ciclo de violência e gera orientações.",
    icon: FileText,
    placeholder: "Deixe vazio para usar o prompt dinâmico padrão (construído a partir da tabela Tipos de Alerta)",
  },
  {
    key: "ia_prompt_macro",
    label: "Análise MACRO (Relatório Agregado)",
    description: "Prompt para gerar o relatório consolidado ('Como estou?'). Recebe dados agregados de múltiplas análises e produz panorama narrativo, orientações e reflexões.",
    icon: BarChart3,
    placeholder: "Deixe vazio para usar o prompt padrão do sistema",
  },
];

interface Setting {
  id: string;
  chave: string;
  valor: string;
}

export default function AdminPromptsIA() {
  const { sessionToken } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!sessionToken) return;
    setLoading(true);
    const { ok, data } = await callAdminApi("listSettings", sessionToken);
    if (ok) {
      const all = (data.settings || []) as Setting[];
      setSettings(all.filter((s) => PROMPTS.some((p) => p.key === s.chave)));
    }
    setEdited({});
    setLoading(false);
  }

  useEffect(() => { load(); }, [sessionToken]);

  function getSetting(key: string) {
    return settings.find((s) => s.chave === key);
  }

  function getValue(key: string) {
    const s = getSetting(key);
    if (!s) return "";
    return edited[s.id] ?? s.valor;
  }

  function isModified(key: string) {
    const s = getSetting(key);
    if (!s) return false;
    return edited[s.id] !== undefined && edited[s.id] !== s.valor;
  }

  async function handleSave(key: string) {
    const s = getSetting(key);
    if (!s || !sessionToken) return;
    const newVal = edited[s.id];
    if (newVal === undefined) return;
    setSaving(key);
    const { ok, data } = await callAdminApi("updateSetting", sessionToken, { id: s.id, valor: newVal });
    setSaving(null);
    if (ok) { toast.success("Prompt atualizado"); load(); }
    else toast.error(data.error || "Erro ao salvar");
  }

  if (loading) return <p className="text-sm text-muted-foreground py-4">Carregando prompts...</p>;

  return (
    <div className="space-y-5">
      {PROMPTS.map((p) => {
        const Icon = p.icon;
        const s = getSetting(p.key);
        const value = getValue(p.key);
        const modified = isModified(p.key);

        return (
          <div key={p.key} className="rounded-lg border border-border bg-card/50 overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{p.label}</h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">{p.description}</p>
              <textarea
                className="w-full min-h-[140px] text-xs font-mono rounded-md border border-border px-3 py-2 bg-background text-foreground resize-y outline-none focus:ring-1 focus:ring-primary/40"
                placeholder={p.placeholder}
                value={value}
                onChange={(e) => s && setEdited((prev) => ({ ...prev, [s.id]: e.target.value }))}
              />
              <div className="flex items-center gap-2">
                {modified && (
                  <>
                    <button
                      onClick={() => s && setEdited((prev) => { const c = { ...prev }; delete c[s.id]; return c; })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Desfazer
                    </button>
                    <button
                      onClick={() => handleSave(p.key)}
                      disabled={saving === p.key}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" /> Salvar
                    </button>
                  </>
                )}
                {value.trim() === "" && (
                  <span className="text-xs text-muted-foreground italic ml-auto">Usando prompt padrão do sistema</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
