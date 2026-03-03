import { useEffect, useState } from "react";
import { Tags, Plus, Pencil, Trash2, Save, X, GripVertical } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

interface TipoAlerta {
  id: string;
  grupo: string;
  codigo: string;
  label: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

const GRUPO_LABELS: Record<string, string> = {
  violencia: "Tipos de Violência",
  tatica: "Táticas Manipulativas",
  risco: "Níveis de Risco",
  contexto: "Classificação de Contexto",
  ciclo: "Fases do Ciclo",
  curadoria: "Curadoria",
};

const GRUPO_COLORS: Record<string, string> = {
  violencia: "bg-destructive/10 text-destructive",
  tatica: "bg-orange-500/10 text-orange-600",
  risco: "bg-yellow-500/10 text-yellow-700",
  contexto: "bg-blue-500/10 text-blue-600",
  ciclo: "bg-purple-500/10 text-purple-600",
  curadoria: "bg-green-500/10 text-green-600",
};

const GRUPO_ORDER = ["violencia", "tatica", "risco", "contexto", "ciclo", "curadoria"];

const emptyItem: Omit<TipoAlerta, "id" | "created_at"> = {
  grupo: "violencia",
  codigo: "",
  label: "",
  descricao: "",
  ordem: 0,
  ativo: true,
};

export default function AdminTiposAlerta() {
  const { sessionToken } = useAuth();
  const [items, setItems] = useState<TipoAlerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TipoAlerta>>({});
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);
  const [filterGrupo, setFilterGrupo] = useState<string>("todos");

  async function loadItems() {
    if (!sessionToken) return;
    setLoading(true);
    const { ok, data } = await callAdminApi("listTiposAlerta", sessionToken);
    if (ok) setItems(data.items || []);
    else toast.error(data.error || "Erro ao carregar");
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, [sessionToken]);

  async function handleCreate() {
    if (!sessionToken || !createForm.codigo.trim() || !createForm.label.trim()) {
      toast.error("Código e label são obrigatórios");
      return;
    }
    setSaving(true);
    const { ok, data } = await callAdminApi("createTipoAlerta", sessionToken, { item: createForm });
    setSaving(false);
    if (ok) {
      toast.success("Tipo criado");
      setCreating(false);
      setCreateForm(emptyItem);
      loadItems();
    } else toast.error(data.error || "Erro ao criar");
  }

  async function handleUpdate(id: string) {
    if (!sessionToken) return;
    setSaving(true);
    const { ok, data } = await callAdminApi("updateTipoAlerta", sessionToken, { id, updates: editForm });
    setSaving(false);
    if (ok) {
      toast.success("Tipo atualizado");
      setEditingId(null);
      loadItems();
    } else toast.error(data.error || "Erro ao atualizar");
  }

  async function handleDelete(id: string) {
    if (!sessionToken || !confirm("Remover este tipo de alerta?")) return;
    const { ok, data } = await callAdminApi("deleteTipoAlerta", sessionToken, { id });
    if (ok) { toast.success("Removido"); loadItems(); }
    else toast.error(data.error || "Erro ao remover");
  }

  async function handleToggleAtivo(item: TipoAlerta) {
    if (!sessionToken) return;
    const { ok, data } = await callAdminApi("updateTipoAlerta", sessionToken, {
      id: item.id,
      updates: { ativo: !item.ativo },
    });
    if (ok) loadItems();
    else toast.error(data.error || "Erro ao atualizar");
  }

  const grouped = GRUPO_ORDER
    .map((g) => ({
      grupo: g,
      label: GRUPO_LABELS[g] || g,
      items: items
        .filter((i) => i.grupo === g)
        .filter(() => filterGrupo === "todos" || filterGrupo === g)
        .sort((a, b) => a.ordem - b.ordem),
    }))
    .filter((g) => g.items.length > 0 || (filterGrupo !== "todos" && filterGrupo === g.grupo));

  // Also include unknown groups
  const knownGroups = new Set(GRUPO_ORDER);
  const unknownGrouped = [...new Set(items.map((i) => i.grupo))]
    .filter((g) => !knownGroups.has(g))
    .map((g) => ({
      grupo: g,
      label: g.charAt(0).toUpperCase() + g.slice(1),
      items: items.filter((i) => i.grupo === g && (filterGrupo === "todos" || filterGrupo === g)),
    }))
    .filter((g) => g.items.length > 0);

  const allGroups = [...grouped, ...unknownGrouped];
  const allGrupos = [...new Set(items.map((i) => i.grupo))];

  return (
    <div>
      {/* Actions */}
      <div className="flex items-center justify-between mb-3">
        <div />
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" /> Novo Tipo
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Filtrar:</span>
        <button
          onClick={() => setFilterGrupo("todos")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            filterGrupo === "todos" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Todos ({items.length})
        </button>
        {GRUPO_ORDER.filter((g) => items.some((i) => i.grupo === g) || g === "violencia").map((g) => (
          <button
            key={g}
            onClick={() => setFilterGrupo(g)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterGrupo === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {GRUPO_LABELS[g] || g} ({items.filter((i) => i.grupo === g).length})
          </button>
        ))}
      </div>

      {/* Create Form */}
      {creating && (
        <div className="rounded-lg border border-border bg-card shadow-sm p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Novo Tipo de Alerta</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Grupo</label>
              <select
                className="w-full mt-1 text-sm rounded-md border border-border px-3 py-2 bg-background text-foreground"
                value={createForm.grupo}
                onChange={(e) => setCreateForm({ ...createForm, grupo: e.target.value })}
              >
                {GRUPO_ORDER.map((g) => (
                  <option key={g} value={g}>{GRUPO_LABELS[g] || g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Código</label>
              <input
                className="w-full mt-1 text-sm rounded-md border border-border px-3 py-2 bg-background text-foreground"
                placeholder="ex: violencia_fisica"
                value={createForm.codigo}
                onChange={(e) => setCreateForm({ ...createForm, codigo: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Label</label>
              <input
                className="w-full mt-1 text-sm rounded-md border border-border px-3 py-2 bg-background text-foreground"
                placeholder="ex: Violência Física"
                value={createForm.label}
                onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ordem</label>
              <input
                type="number"
                className="w-full mt-1 text-sm rounded-md border border-border px-3 py-2 bg-background text-foreground"
                value={createForm.ordem}
                onChange={(e) => setCreateForm({ ...createForm, ordem: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
            <input
              className="w-full mt-1 text-sm rounded-md border border-border px-3 py-2 bg-background text-foreground"
              placeholder="Descrição do tipo"
              value={createForm.descricao || ""}
              onChange={(e) => setCreateForm({ ...createForm, descricao: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
            >
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
            <button
              onClick={() => { setCreating(false); setCreateForm(emptyItem); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="rounded-lg border border-border bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      ) : allGroups.length === 0 ? (
        <div className="rounded-lg border border-border bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum tipo encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allGroups.map((group) => (
            <div key={group.grupo} className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/50">
                <Tags className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
                <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
              </div>

              {group.items.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhum item neste grupo
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {group.items.map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />

                      {editingId === item.id ? (
                        /* Inline edit */
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                          <input
                            className="text-sm rounded-md border border-border px-2 py-1.5 bg-background text-foreground"
                            value={editForm.codigo || ""}
                            onChange={(e) => setEditForm({ ...editForm, codigo: e.target.value })}
                            placeholder="Código"
                          />
                          <input
                            className="text-sm rounded-md border border-border px-2 py-1.5 bg-background text-foreground"
                            value={editForm.label || ""}
                            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                            placeholder="Label"
                          />
                          <input
                            className="text-sm rounded-md border border-border px-2 py-1.5 bg-background text-foreground"
                            value={editForm.descricao || ""}
                            onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                            placeholder="Descrição"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="text-sm rounded-md border border-border px-2 py-1.5 bg-background text-foreground w-16"
                              value={editForm.ordem ?? 0}
                              onChange={(e) => setEditForm({ ...editForm, ordem: Number(e.target.value) })}
                            />
                            <button
                              onClick={() => handleUpdate(item.id)}
                              disabled={saving}
                              className="p-1.5 rounded hover:bg-muted"
                              title="Salvar"
                            >
                              <Save className="w-4 h-4 text-primary" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded hover:bg-muted"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Display */
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono text-foreground">
                                {item.codigo}
                              </code>
                              <span className="text-sm font-medium text-foreground">{item.label}</span>
                              {!item.ativo && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                              )}
                            </div>
                            {item.descricao && (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>
                            )}
                          </div>

                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            #{item.ordem}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Toggle ativo */}
                            <button
                              onClick={() => handleToggleAtivo(item)}
                              className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                              style={{
                                background: item.ativo ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)",
                              }}
                              title={item.ativo ? "Desativar" : "Ativar"}
                            >
                              <span
                                className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                                style={{ left: item.ativo ? 16 : 2 }}
                              />
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setEditForm({
                                  codigo: item.codigo,
                                  label: item.label,
                                  descricao: item.descricao,
                                  ordem: item.ordem,
                                });
                              }}
                              className="p-1.5 rounded hover:bg-muted"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1.5 rounded hover:bg-destructive/10"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
