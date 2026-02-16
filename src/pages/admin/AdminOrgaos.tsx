import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

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
  created_at: string;
}

const emptyForm: Omit<Tenant, "id" | "created_at"> = {
  nome: "",
  sigla: "",
  tipo: "orgao",
  cnpj: null,
  email_contato: null,
  telefone_contato: null,
  endereco: null,
  cidade: null,
  uf: null,
  responsavel_nome: null,
  responsavel_email: null,
  ativo: true,
  max_usuarios: 50,
};

export default function AdminOrgaos() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function loadTenants() {
    setLoading(true);
    const { data } = await supabase
      .from("tenants")
      .select("*")
      .order("nome");
    setTenants((data as Tenant[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    loadTenants();
  }, []);

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
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    if (editing) {
      await supabase.from("tenants").update(form).eq("id", editing.id);
    } else {
      await supabase.from("tenants").insert(form);
    }
    setSaving(false);
    setDialogOpen(false);
    loadTenants();
  }

  async function handleDelete(id: string) {
    await supabase.from("tenants").delete().eq("id", id);
    setDeleteConfirm(null);
    loadTenants();
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
    <div style={fontStyle}>
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>
          Admin &gt; Órgãos/Tenants
        </p>
        <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
          Gestão de Órgãos
        </h1>
        <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>
          Cadastro e gestão de órgãos conveniados ao sistema
        </p>
      </div>

      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-md border"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "hsl(220 9% 46%)" }}
          />
          <input
            type="text"
            placeholder="Buscar por nome ou sigla..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors"
          style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
        >
          <Plus className="w-4 h-4" /> Novo Órgão
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-md border overflow-hidden"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(210 17% 96%)" }}>
                {["Órgão", "Sigla", "Responsável", "Cidade/UF", "Max Usuários", "Status", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "hsl(220 9% 46%)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: "hsl(220 9% 46%)" }}>
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: "hsl(220 9% 46%)" }}>
                    Nenhum órgão encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-t" style={{ borderColor: "hsl(220 13% 91%)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 shrink-0" style={{ color: "hsl(224 76% 33%)" }} />
                        <span className="font-medium" style={{ color: "hsl(220 13% 18%)" }}>{t.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "hsl(220 13% 18%)" }}>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ background: "hsl(224 76% 33% / 0.08)", color: "hsl(224 76% 33%)" }}
                      >
                        {t.sigla}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "hsl(220 13% 18%)" }}>
                      {t.responsavel_nome || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "hsl(220 13% 18%)" }}>
                      {t.cidade && t.uf ? `${t.cidade}/${t.uf}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "hsl(220 13% 18%)" }}>
                      {t.max_usuarios}
                    </td>
                    <td className="px-4 py-3">
                      <GovStatusBadge
                        status={t.ativo ? "verde" : "vermelho"}
                        label={t.ativo ? "Ativo" : "Inativo"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" style={{ color: "hsl(224 76% 33%)" }} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(t.id)}
                          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "hsl(0 73% 42%)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t text-xs" style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}>
          {filtered.length} órgão(s) encontrado(s)
        </div>
      </div>

      {/* Delete Confirm Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeleteConfirm(null)}>
          <div
            className="rounded-lg border p-6 max-w-sm w-full mx-4"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
              Confirmar exclusão
            </h3>
            <p className="text-xs mb-4" style={{ color: "hsl(220 9% 46%)" }}>
              Tem certeza que deseja excluir este órgão? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs rounded border"
                style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-3 py-1.5 text-xs rounded font-semibold"
                style={{ background: "hsl(0 73% 42%)", color: "#fff" }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDialogOpen(false)}>
          <div
            className="rounded-lg border p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)", ...fontStyle }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
                {editing ? "Editar Órgão" : "Novo Órgão"}
              </h3>
              <button onClick={() => setDialogOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" style={{ color: "hsl(220 9% 46%)" }} />
              </button>
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
                <select
                  style={inputStyle}
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  <option value="orgao">Órgão Público</option>
                  <option value="ong">ONG</option>
                  <option value="parceiro">Parceiro</option>
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
                <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(220 9% 46%)" }}>Telefone Contato</label>
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
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Ativo</label>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-xs rounded border"
                style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nome || !form.sigla}
                className="px-4 py-2 text-xs rounded font-semibold disabled:opacity-50"
                style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
              >
                {saving ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Órgão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
