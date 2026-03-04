import { useEffect, useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
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
  const data = await res.json();
  return { ok: res.ok, data };
}

interface Palavra {
  id: string;
  palavra: string;
  grupo: string;
  peso: number;
  ativo: boolean;
  created_at: string;
}

const GRUPOS = [
  { value: "ameaca", label: "Ameaça", color: "bg-red-500/15 text-red-400" },
  { value: "arma", label: "Arma", color: "bg-orange-500/15 text-orange-400" },
  { value: "socorro", label: "Socorro", color: "bg-blue-500/15 text-blue-400" },
  { value: "xingamento", label: "Xingamento", color: "bg-purple-500/15 text-purple-400" },
];

const PESO_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Normal", color: "bg-muted text-muted-foreground" },
  2: { label: "Alto", color: "bg-yellow-500/15 text-yellow-400" },
  3: { label: "Crítico", color: "bg-red-500/15 text-red-400" },
};

export default function AdminPalavrasTriagem() {
  const { sessionToken } = useAuth();
  const [items, setItems] = useState<Palavra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroGrupo, setFiltroGrupo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // New word form
  const [novaPalavra, setNovaPalavra] = useState("");
  const [novoGrupo, setNovoGrupo] = useState("ameaca");
  const [novoPeso, setNovoPeso] = useState(1);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!sessionToken) return;
    setLoading(true);
    const { ok, data } = await callAdminApi("listPalavrasTriagem", sessionToken);
    if (ok) setItems(data.items || []);
    else toast.error(data.error || "Erro ao carregar palavras");
    setLoading(false);
  }

  useEffect(() => { load(); }, [sessionToken]);

  async function handleAdd() {
    if (!sessionToken || !novaPalavra.trim()) return;
    setSaving(true);
    const { ok, data } = await callAdminApi("upsertPalavraTriagem", sessionToken, {
      palavra: novaPalavra, grupo: novoGrupo, peso: novoPeso, ativo: true,
    });
    setSaving(false);
    if (ok) { toast.success("Palavra adicionada"); setNovaPalavra(""); load(); }
    else toast.error(data.error || "Erro ao salvar");
  }

  async function handleToggle(item: Palavra) {
    if (!sessionToken) return;
    await callAdminApi("upsertPalavraTriagem", sessionToken, {
      id: item.id, palavra: item.palavra, grupo: item.grupo, peso: item.peso, ativo: !item.ativo,
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!sessionToken) return;
    const { ok, data } = await callAdminApi("deletePalavraTriagem", sessionToken, { id });
    if (ok) { toast.success("Removida"); load(); }
    else toast.error(data.error || "Erro ao remover");
  }

  const filtered = items.filter((i) => {
    if (filtroGrupo && i.grupo !== filtroGrupo) return false;
    if (busca && !i.palavra.includes(busca.toLowerCase())) return false;
    return true;
  });

  const counts = GRUPOS.map((g) => ({
    ...g,
    count: items.filter((i) => i.grupo === g.value).length,
  }));

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Carregando palavras de triagem...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filtros por grupo */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroGrupo(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !filtroGrupo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Todos ({items.length})
        </button>
        {counts.map((g) => (
          <button
            key={g.value}
            onClick={() => setFiltroGrupo(filtroGrupo === g.value ? null : g.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtroGrupo === g.value ? "bg-primary text-primary-foreground" : `${g.color} hover:opacity-80`
            }`}
          >
            {g.label} ({g.count})
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar palavra..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background text-foreground outline-none"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {/* Adicionar nova */}
      <div className="flex items-end gap-2 p-3 rounded-lg border border-border bg-muted/30">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Palavra / Expressão</label>
          <input
            type="text"
            className="w-full text-sm rounded-md border border-border px-3 py-2 bg-background text-foreground outline-none"
            value={novaPalavra}
            onChange={(e) => setNovaPalavra(e.target.value)}
            placeholder="ex: vou te matar"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Grupo</label>
          <select
            className="text-sm rounded-md border border-border px-2 py-2 bg-background text-foreground outline-none"
            value={novoGrupo}
            onChange={(e) => setNovoGrupo(e.target.value)}
          >
            {GRUPOS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Peso</label>
          <select
            className="text-sm rounded-md border border-border px-2 py-2 bg-background text-foreground outline-none"
            value={novoPeso}
            onChange={(e) => setNovoPeso(Number(e.target.value))}
          >
            <option value={1}>Normal</option>
            <option value={2}>Alto</option>
            <option value={3}>Crítico</option>
          </select>
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !novaPalavra.trim()}
          className="flex items-center gap-1 px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>

      {/* Lista */}
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma palavra encontrada</p>
        ) : (
          filtered.map((item) => {
            const grupoInfo = GRUPOS.find((g) => g.value === item.grupo);
            const pesoInfo = PESO_LABELS[item.peso] || PESO_LABELS[1];
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors ${!item.ativo ? "opacity-50" : ""}`}
              >
                {/* Toggle ativo */}
                <button
                  onClick={() => handleToggle(item)}
                  className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                  style={{ background: item.ativo ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)" }}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                    style={{ left: item.ativo ? 17 : 2 }}
                  />
                </button>

                {/* Palavra */}
                <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                  {item.palavra}
                </span>

                {/* Grupo badge */}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${grupoInfo?.color || "bg-muted text-muted-foreground"}`}>
                  {grupoInfo?.label || item.grupo}
                </span>

                {/* Peso badge */}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pesoInfo.color}`}>
                  {pesoInfo.label}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} de {items.length} palavras · Peso determina prioridade na triagem de segmentos
      </p>
    </div>
  );
}
