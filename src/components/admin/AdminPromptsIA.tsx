import { useState, useEffect, useMemo } from "react";
import { Save, RotateCcw, Zap, FileText, BarChart3, Eye, Pencil, WrapText, Type, Hash, AlignLeft, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  placeholder: string;
  color: string;
}

const PROMPTS: PromptConfig[] = [
  {
    key: "ia_prompt_triagem",
    label: "Triagem Rápida",
    shortLabel: "Triagem",
    description: "Prompt leve e rápido para classificar risco (seguro/moderado/alto/critico) e extrair contexto de emergência. Usa modelo Flash-Lite para máxima velocidade.",
    icon: Zap,
    color: "text-yellow-500",
    placeholder: "Prompt de classificação rápida de risco...",
  },
  {
    key: "ia_prompt_analise",
    label: "Análise MICRO (Individual)",
    shortLabel: "MICRO",
    description: "Prompt completo para análise individual de cada gravação/conversa. Identifica tipos de violência, táticas manipulativas, ciclo de violência e gera orientações.",
    icon: FileText,
    color: "text-blue-500",
    placeholder: "Deixe vazio para usar o prompt dinâmico padrão (construído a partir da tabela Tipos de Alerta)",
  },
  {
    key: "ia_prompt_macro",
    label: "Análise MACRO (Relatório Agregado)",
    shortLabel: "MACRO",
    description: "Prompt para gerar o relatório consolidado ('Como estou?'). Recebe dados agregados de múltiplas análises e produz panorama narrativo, orientações e reflexões.",
    icon: BarChart3,
    color: "text-emerald-500",
    placeholder: "Deixe vazio para usar o prompt padrão do sistema",
  },
];

interface Setting {
  id: string;
  chave: string;
  valor: string;
}

/* ── Prompt stats helper ── */
function usePromptStats(text: string) {
  return useMemo(() => {
    if (!text) return { chars: 0, words: 0, lines: 0, sections: 0 };
    const chars = text.length;
    const words = text.split(/\s+/).filter(Boolean).length;
    const lines = text.split("\n").length;
    const sections = text.split(/\n\n+/).filter((s) => s.trim()).length;
    return { chars, words, lines, sections };
  }, [text]);
}

/* ── Section highlight for preview ── */
function PromptPreview({ text }: { text: string }) {
  if (!text) return <p className="text-sm text-muted-foreground italic py-8 text-center">Prompt vazio - usando prompt padrão do sistema</p>;

  const sections = text.split(/\n\n+/);
  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
      {sections.map((section, i) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        // Detect if it's a JSON block
        const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");
        // Detect if it's a header-like line (all caps or ends with :)
        const firstLine = trimmed.split("\n")[0];
        const isHeader = /^[A-ZÁÉÍÓÚÃÕÇ\s()/:]+:?$/.test(firstLine.trim()) || firstLine.trim().endsWith(":");

        if (isJson) {
          return (
            <div key={i} className="rounded-md border border-border bg-muted/30 p-3">
              <Badge variant="outline" className="mb-2 text-[10px]">JSON Schema</Badge>
              <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-words">{trimmed}</pre>
            </div>
          );
        }

        return (
          <div key={i} className="rounded-md border border-border/50 p-3">
            {isHeader && (
              <div className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider mb-1">
                Seção {i + 1}
              </div>
            )}
            <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{trimmed}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ── */
export default function AdminPromptsIA() {
  const { sessionToken } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(PROMPTS[0].key);
  const [viewMode, setViewMode] = useState<Record<string, "edit" | "preview">>({});
  const [copied, setCopied] = useState(false);

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

  function getMode(key: string): "edit" | "preview" {
    return viewMode[key] || "edit";
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

  async function handleCopy(key: string) {
    const value = getValue(key);
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Prompt copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <p className="text-sm text-muted-foreground py-4">Carregando prompts...</p>;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full grid grid-cols-3 mb-4">
        {PROMPTS.map((p) => {
          const Icon = p.icon;
          const modified = isModified(p.key);
          return (
            <TabsTrigger key={p.key} value={p.key} className="flex items-center gap-1.5 text-xs relative">
              <Icon className={`w-3.5 h-3.5 ${p.color}`} />
              <span className="hidden sm:inline">{p.shortLabel}</span>
              <span className="sm:hidden">{p.shortLabel}</span>
              {modified && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {PROMPTS.map((p) => (
        <TabsContent key={p.key} value={p.key} className="mt-0">
          <PromptTabPanel
            config={p}
            setting={getSetting(p.key)}
            value={getValue(p.key)}
            modified={isModified(p.key)}
            mode={getMode(p.key)}
            saving={saving === p.key}
            copied={copied}
            onEdit={(val) => {
              const s = getSetting(p.key);
              if (s) setEdited((prev) => ({ ...prev, [s.id]: val }));
            }}
            onUndo={() => {
              const s = getSetting(p.key);
              if (s) setEdited((prev) => { const c = { ...prev }; delete c[s.id]; return c; });
            }}
            onSave={() => handleSave(p.key)}
            onCopy={() => handleCopy(p.key)}
            onSetMode={(m) => setViewMode((prev) => ({ ...prev, [p.key]: m }))}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
