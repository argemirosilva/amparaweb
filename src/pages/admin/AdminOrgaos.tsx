import { useEffect, useState } from "react";
import { Building2, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminTableWrapper from "@/components/admin/AdminTableWrapper";

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

interface Tenant {
  id: string;
  nome: string;
  sigla: string;
  tipo: string;
  cnpj: string | null;
  email_contato: string | null;
  telefone_contato: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
  ativo: boolean;
  max_usuarios: number;
  telas_permitidas?: string[];
  usuarios_ativos?: number;
  created_at: string;
}

// Mesma lista do AdminLayout (sidebar)
const AVAILABLE_SCREENS: { path: string; label: string }[] = [
  { path: "/admin", label: "Dashboard" },
  { path: "/admin/usuarios", label: "Usuários" },
  { path: "/admin/suporte", label: "Suporte" },
  { path: "/admin/curadoria", label: "Curadoria IA" },
  { path: "/admin/tribunal", label: "Tribunal" },
  { path: "/admin/orgaos", label: "Entidades" },
  { path: "/admin/auditoria", label: "Auditoria" },
  { path: "/admin/relatorios", label: "Relatórios" },
  { path: "/admin/configuracoes", label: "Configurações" },
  { path: "/admin/integracoes", label: "Integrações" },
  { path: "/admin/doc-api", label: "Doc API" },
];

const emptyForm = {
  nome: "",
  sigla: "",
  tipo: "orgao",
  cnpj: null as string | null,
  email_contato: null as string | null,
  telefone_contato: null as string | null,
  endereco: null as string | null,
  cidade: null as string | null,
  uf: null as string | null,
  responsavel_nome: null as string | null,
  responsavel_email: null as string | null,
  ativo: true,
  max_usuarios: 50,
  telas_permitidas: [] as string[],
};

export default function AdminOrgaos() {
  const { sessionToken } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function loadTenants() {
    if (!sessionToken) return;
    setLoading(true);
    const { ok, data } = await callAdminApi("listTenants", sessionToken);
    if (ok) setTenants(data.tenants || []);
    else toast.error(data.error || "Erro ao carregar entidades");
    setLoading(false);
  }

  useEffect(() => {
    loadTenants();
  }, [sessionToken]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(t: Tenant) {
    setEditing(t);
    setForm({
      nome: t.nome,
      sigla: t.sigla,
      tipo: t.tipo,
      cnpj: t.cnpj,
      email_contato: t.email_contato,
      telefone_contato: t.telefone_contato,
      endereco: t.endereco,
      cidade: t.cidade,
      uf: t.uf,
      responsavel_nome: t.responsavel_nome,
      responsavel_email: t.responsavel_email,
      ativo: t.ativo,
      max_usuarios: t.max_usuarios,
      telas_permitidas: Array.isArray(t.telas_permitidas) ? t.telas_permitidas : [],
    });
    setDialogOpen(true);
  }

  function toggleTela(path: string) {
    setForm((f) => {
      const has = f.telas_permitidas.includes(path);
      return {
        ...f,
        telas_permitidas: has
          ? f.telas_permitidas.filter((p) => p !== path)
          : [...f.telas_permitidas, path],
      };
    });
  }

  function selectAllTelas() {
    setForm((f) => ({ ...f, telas_permitidas: AVAILABLE_SCREENS.map((s) => s.path) }));
  }

  function clearAllTelas() {
    setForm((f) => ({ ...f, telas_permitidas: [] }));
  }

  async function handleSave() {
    if (!sessionToken) return;
    setSaving(true);
    let result;
    if (editing) {
      result = await callAdminApi("updateTenant", sessionToken, { id: editing.id, updates: form });
    } else {
      result = await callAdminApi("createTenant", sessionToken, { tenant: form });
    }
    setSaving(false);
    if (result.ok) {
      toast.success(editing ? "Entidade atualizada" : "Entidade criada");
      setDialogOpen(false);
      loadTenants();
    } else {
      toast.error(result.data.error || "Erro ao salvar");
    }
  }

  async function handleDelete(id: string) {
    if (!sessionToken) return;
    const { ok, data } = await callAdminApi("deleteTenant", sessionToken, { id });
    if (ok) {
      toast.success("Entidade excluída");
      loadTenants();
    } else {
      toast.error(data.error || "Erro ao excluir");
    }
    setDeleteConfirm(null);
  }

  const filtered = tenants.filter(
    (t) =>
      t.nome.toLowerCase().includes(search.toLowerCase()) ||
      t.sigla.toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle = {
    border: "1px solid hsl(220 13% 91%)",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    width: "100%",
    outline: "none",
    fontFamily: "Inter, Roboto, sans-serif",
    color: "hsl(220 13% 18%)",
  };

  return (
    <div>
      <AdminPageHeader
        icon={Building2}
        breadcrumb="Admin › Entidades"
        title="Gestão de Entidades"
        description="Cadastro e gestão de entidades conveniadas ao sistema"
        actions={
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova Entidade
          </button>
        }
      />

      <AdminFilterBar>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome ou sigla..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-sm rounded-md border border-border px-3 py-2 pl-9 outline-none bg-background text-foreground w-full" />
        </div>
      </AdminFilterBar>

      <AdminTableWrapper footer={<>{filtered.length} entidade(s) encontrada(s)</>}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {["Entidade", "Sigla", "Responsável", "Cidade/UF", "Max Usuários", "Status", "Ações"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma entidade encontrada</td></tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 shrink-0 text-primary" />
                      <span className="font-medium text-foreground">{t.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary">{t.sigla}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">{t.responsavel_nome || "-"}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{t.cidade && t.uf ? `${t.cidade}/${t.uf}` : "-"}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={(t.usuarios_ativos ?? 0) >= t.max_usuarios ? "text-destructive font-semibold" : "text-foreground"}>
                      {t.usuarios_ativos ?? 0}/{t.max_usuarios}
                    </span>
                  </td>
                  <td className="px-4 py-3"><GovStatusBadge status={t.ativo ? "verde" : "vermelho"} label={t.ativo ? "Ativo" : "Inativo"} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded hover:bg-muted" title="Editar">
                        <Pencil className="w-3.5 h-3.5 text-primary" />
                      </button>
                      <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 rounded hover:bg-muted" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableWrapper>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeleteConfirm(null)}>
          <div className="rounded-lg border p-6 max-w-sm w-full mx-4" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>Confirmar exclusão</h3>
            <p className="text-xs mb-4" style={{ color: "hsl(220 9% 46%)" }}>Tem certeza que deseja excluir esta entidade? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-xs rounded border" style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}>Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-3 py-1.5 text-xs rounded font-semibold" style={{ background: "hsl(0 73% 42%)", color: "#fff" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDialogOpen(false)}>
          <div className="rounded-lg border border-border bg-card p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{editing ? "Editar Entidade" : "Nova Entidade"}</h3>
              <button onClick={() => setDialogOpen(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" style={{ color: "hsl(220 9% 46%)" }} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Nome *</label>
                <input style={inputStyle} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Sigla *</label>
                <input style={inputStyle} value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Tipo</label>
                <select style={inputStyle} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  <option value="orgao">Órgão Público</option>
                  <option value="ong">ONG</option>
                  <option value="parceiro">Parceiro</option>
                  <option value="interno">Interno (Suporte/Técnico)</option>
                  <option value="tribunal">Tribunal / Magistratura</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>CNPJ</label>
                <input style={inputStyle} value={form.cnpj || ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>E-mail Contato</label>
                <input style={inputStyle} value={form.email_contato || ""} onChange={(e) => setForm({ ...form, email_contato: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Telefone</label>
                <input style={inputStyle} value={form.telefone_contato || ""} onChange={(e) => setForm({ ...form, telefone_contato: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Responsável</label>
                <input style={inputStyle} value={form.responsavel_nome || ""} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>E-mail Responsável</label>
                <input style={inputStyle} value={form.responsavel_email || ""} onChange={(e) => setForm({ ...form, responsavel_email: e.target.value || null })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Endereço</label>
                <input style={inputStyle} value={form.endereco || ""} onChange={(e) => setForm({ ...form, endereco: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Cidade</label>
                <input style={inputStyle} value={form.cidade || ""} onChange={(e) => setForm({ ...form, cidade: e.target.value || null })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>UF</label>
                <input style={inputStyle} maxLength={2} value={form.uf || ""} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() || null })} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Max Usuários</label>
                <input style={inputStyle} type="number" min={1} value={form.max_usuarios} onChange={(e) => setForm({ ...form, max_usuarios: parseInt(e.target.value) || 50 })} />
              </div>
              <div className="flex items-center gap-2 self-end pb-1">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="w-4 h-4" />
                <label className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Ativo</label>
              </div>

              {/* Telas Permitidas */}
              <div className="sm:col-span-2 border-t pt-3 mt-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
                    Telas Permitidas
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAllTelas} className="text-[11px] underline text-primary">Selecionar todas</button>
                    <button type="button" onClick={clearAllTelas} className="text-[11px] underline text-muted-foreground">Limpar</button>
                  </div>
                </div>
                <p className="text-[11px] mb-2" style={{ color: "hsl(220 9% 46%)" }}>
                  Quando vazio, todas as telas (conforme o papel do usuário) ficam disponíveis. Selecione para restringir.
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {AVAILABLE_SCREENS.map((s) => (
                    <label key={s.path} className="flex items-center gap-2 text-xs cursor-pointer rounded px-2 py-1 hover:bg-muted/40" style={{ color: "hsl(220 13% 18%)" }}>
                      <input
                        type="checkbox"
                        checked={form.telas_permitidas.includes(s.path)}
                        onChange={() => toggleTela(s.path)}
                        className="w-3.5 h-3.5"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setDialogOpen(false)} className="px-4 py-2 text-xs rounded border" style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.nome || !form.sigla} className="px-4 py-2 text-xs rounded font-semibold disabled:opacity-50" style={{ background: "hsl(207 89% 42%)", color: "#fff" }}>
                {saving ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Entidade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
