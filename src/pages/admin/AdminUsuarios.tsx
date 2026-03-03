import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";
import { Plus, X, Search, ChevronLeft, ChevronRight, Building2, Loader2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminTableWrapper from "@/components/admin/AdminTableWrapper";
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface UserRow {
  id: string;
  nome_completo: string;
  email: string;
  status: string;
  ultimo_acesso: string | null;
  created_at: string;
  orgao?: string | null;
  role?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_administrador: "Super Administrador",
  administrador: "Administrador",
  admin_master: "Técnico",
  admin_tenant: "Operacional",
  operador: "Operacional",
  suporte: "Suporte",
};

interface TenantOption {
  id: string;
  nome: string;
  sigla: string;
}

export default function AdminUsuarios() {
  const { sessionToken } = useAuth();
  const { isAdministrador } = useAdminRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerUser, setDrawerUser] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [tenantFilter, setTenantFilter] = useState<string>("todos");
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  // Edit user state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ nome_completo: "", email: "", status: "", tenant_id: "", role: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Block user state
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // Delete user state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Activate user state
  const [activateLoading, setActivateLoading] = useState(false);

  // Create user dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ nome_completo: "", email: "", tenant_id: "", role: "operador" });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);

  // Load tenants for filter
  useEffect(() => {
    supabase
      .from("tenants")
      .select("id, nome, sigla")
      .order("nome")
      .then(({ data }) => setTenants((data as TenantOption[]) || []));
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadUsers = async () => {
    setLoading(true);
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let filteredUserIds: string[] | null = null;
    if (tenantFilter !== "todos") {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenantFilter);
      filteredUserIds = (roleRows || []).map((r) => r.user_id);
      if (filteredUserIds.length === 0) {
        setUsers([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("usuarios")
      .select("id, nome_completo, email, status, ultimo_acesso, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (debouncedSearch) {
      query = query.or(`nome_completo.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
    }
    if (statusFilter !== "todos") {
      query = query.eq("status", statusFilter as "ativo" | "pendente" | "inativo" | "bloqueado");
    }
    if (filteredUserIds) {
      query = query.in("id", filteredUserIds);
    }

    const { data, count } = await query;
    const userRows = (data || []) as UserRow[];

    if (userRows.length > 0) {
      const userIds = userRows.map((u) => u.id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, tenant_id, role")
        .in("user_id", userIds);

      if (roles && roles.length > 0) {
        const tenantMap: Record<string, string> = {};
        for (const t of tenants) {
          tenantMap[t.id] = t.sigla;
        }
        const tenantIds = [...new Set(roles.map((r) => r.tenant_id).filter(Boolean))] as string[];
        const missingIds = tenantIds.filter((tid) => !tenantMap[tid]);
        if (missingIds.length > 0) {
          const { data: extraTenants } = await supabase
            .from("tenants")
            .select("id, sigla")
            .in("id", missingIds);
          for (const t of extraTenants || []) {
            tenantMap[t.id] = t.sigla;
          }
        }
        const userTenantMap: Record<string, string> = {};
        const userRoleMap: Record<string, string> = {};
        for (const r of roles) {
          if (r.tenant_id && tenantMap[r.tenant_id]) {
            userTenantMap[r.user_id] = tenantMap[r.tenant_id];
          }
          if (r.role) {
            userRoleMap[r.user_id] = r.role;
          }
        }
        for (const u of userRows) {
          u.orgao = userTenantMap[u.id] || null;
          u.role = userRoleMap[u.id] || null;
        }
      }
    }

    setUsers(userRows);
    setTotalCount(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, [debouncedSearch, statusFilter, tenantFilter, page, pageSize, tenants]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const statusMap: Record<string, "verde" | "amarelo" | "laranja" | "vermelho"> = {
    ativo: "verde",
    pendente: "amarelo",
    inativo: "laranja",
    bloqueado: "vermelho",
  };

  const openCreateDialog = () => {
    setCreateForm({ nome_completo: "", email: "", tenant_id: "", role: "operador" });
    setCreateError("");
    setCreateSuccess(false);
    setShowCreateDialog(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!createForm.nome_completo.trim()) { setCreateError("Nome é obrigatório"); return; }
    if (!createForm.email.trim()) { setCreateError("Email é obrigatório"); return; }
    if (!createForm.tenant_id) { setCreateError("Selecione um órgão"); return; }

    setCreateLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({
          action: "createUser",
          session_token: sessionToken,
          nome_completo: createForm.nome_completo.trim(),
          email: createForm.email.trim(),
          tenant_id: createForm.tenant_id,
          role: createForm.role,
          app_url: window.location.origin,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCreateSuccess(true);
        loadUsers();
      } else {
        setCreateError(data.error || "Erro ao criar usuário");
      }
    } catch {
      setCreateError("Erro de conexão");
    }
    setCreateLoading(false);
  };

  return (
    <div className="relative">
      <AdminPageHeader
        icon={Users}
        breadcrumb="Admin › Usuários"
        title="Usuários"
        description="Gerencie usuárias e administradores do sistema"
        actions={
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-border flex-1 sm:flex-initial sm:w-72 bg-muted/30">
              <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome ou email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent outline-none text-sm w-full text-foreground"
              />
              {search && (
                <button onClick={() => setSearch("")} className="shrink-0">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <button
              onClick={openCreateDialog}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-colors shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" /> Novo
            </button>
          </div>
        }
      />

      <AdminFilterBar>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: "todos", label: "Todos" },
            { value: "ativo", label: "Ativo" },
            { value: "pendente", label: "Pendente" },
            { value: "inativo", label: "Inativo" },
            { value: "bloqueado", label: "Bloqueado" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(0); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {tenants.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={tenantFilter}
              onChange={(e) => { setTenantFilter(e.target.value); setPage(0); }}
              className="text-xs rounded border border-border px-2 py-1.5 bg-background text-foreground outline-none cursor-pointer"
            >
              <option value="todos">Todos os órgãos</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.sigla} — {t.nome}</option>
              ))}
            </select>
          </div>
        )}
      </AdminFilterBar>

      <AdminTableWrapper>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {["Nome", "Email", "Órgão", "Papel", "Status", "Último login", "Ações"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr>
                 <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                   Carregando…
                 </td>
               </tr>
             ) : users.length === 0 ? (
               <tr>
                 <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                   Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{u.nome_completo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.orgao || <span className="opacity-40">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.role ? (ROLE_LABELS[u.role] || u.role) : <span className="opacity-40">Usuária</span>}
                  </td>
                  <td className="px-4 py-3">
                    <GovStatusBadge status={statusMap[u.status] || "amarelo"} label={u.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDrawerUser(u)}
                      className="text-xs font-medium px-3 py-1 rounded border border-primary text-primary transition-colors hover:bg-primary/5"
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableWrapper>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>
            {totalCount} registro{totalCount !== 1 ? "s" : ""}
            {totalPages > 1 && <> · Página {page + 1} de {totalPages}</>}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>Exibir</span>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => { setPageSize(size); setPage(0); }}
                className="px-2 py-1 rounded border text-xs font-medium transition-colors"
                style={{
                  borderColor: pageSize === size ? "hsl(207 89% 42%)" : "hsl(220 13% 87%)",
                  background: pageSize === size ? "hsl(207 89% 42%)" : "transparent",
                  color: pageSize === size ? "#fff" : "hsl(220 9% 46%)",
                }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border transition-colors disabled:opacity-40"
              style={{ borderColor: "hsl(220 13% 87%)" }}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: "hsl(220 9% 46%)" }} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i;
              else if (page < 3) pageNum = i;
              else if (page > totalPages - 4) pageNum = totalPages - 5 + i;
              else pageNum = page - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className="w-8 h-8 rounded border text-xs font-medium transition-colors"
                  style={{
                    borderColor: page === pageNum ? "hsl(207 89% 42%)" : "hsl(220 13% 87%)",
                    background: page === pageNum ? "hsl(207 89% 42%)" : "transparent",
                    color: page === pageNum ? "#fff" : "hsl(220 9% 46%)",
                  }}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded border transition-colors disabled:opacity-40"
              style={{ borderColor: "hsl(220 13% 87%)" }}
            >
              <ChevronRight className="w-4 h-4" style={{ color: "hsl(220 9% 46%)" }} />
            </button>
          </div>
        )}
      </div>

      {/* Details Drawer */}
      {drawerUser && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => { setDrawerUser(null); setEditMode(false); setBlockConfirm(false); setDeleteConfirm(false); }} />
          <div
            className="fixed right-0 top-0 h-full w-full max-w-md z-50 border-l overflow-y-auto p-6"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
                {editMode ? "Editar Usuário" : "Detalhes do Usuário"}
              </h2>
              <button onClick={() => { setDrawerUser(null); setEditMode(false); setBlockConfirm(false); setDeleteConfirm(false); }}>
                <X className="w-5 h-5" style={{ color: "hsl(220 9% 46%)" }} />
              </button>
            </div>

            {editMode ? (
              <div className="space-y-4 text-sm">
                {editError && (
                  <div className="rounded-md border p-3 text-xs" style={{ background: "hsl(0 73% 42% / 0.06)", borderColor: "hsl(0 73% 42% / 0.2)", color: "hsl(0 73% 42%)" }}>
                    {editError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Nome completo</label>
                  <input
                    type="text"
                    value={editForm.nome_completo}
                    onChange={(e) => setEditForm((f) => ({ ...f, nome_completo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Órgão</label>
                  <select
                    value={editForm.tenant_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, tenant_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none cursor-pointer"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                  >
                    <option value="">Sem órgão</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.sigla} — {t.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Papel</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none cursor-pointer"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                  >
                    <option value="">Usuária (sem acesso admin)</option>
                    {isAdministrador && <option value="super_administrador">Super Administrador</option>}
                    {isAdministrador && <option value="administrador">Administrador</option>}
                    <option value="admin_master">Técnico</option>
                    <option value="operador">Operacional</option>
                    <option value="suporte">Suporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none cursor-pointer"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="pendente">Pendente</option>
                    <option value="inativo">Inativo</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 rounded text-xs font-semibold border transition-colors hover:bg-gray-50"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 9% 46%)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      setEditError("");
                      if (!editForm.nome_completo.trim()) { setEditError("Nome é obrigatório"); return; }
                      if (!editForm.email.trim()) { setEditError("Email é obrigatório"); return; }
                      setEditLoading(true);
                      try {
                        const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
                         body: JSON.stringify({
                            action: "updateUser",
                            session_token: sessionToken,
                            user_id: drawerUser.id,
                            nome_completo: editForm.nome_completo.trim(),
                            email: editForm.email.trim(),
                            status: editForm.status,
                            tenant_id: editForm.tenant_id || null,
                            role: editForm.role || null,
                          }),
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          toast({ title: "Usuário atualizado", description: "As alterações foram salvas com sucesso." });
                          setEditMode(false);
                          setDrawerUser(null);
                          loadUsers();
                        } else {
                          setEditError(data.error || "Erro ao atualizar usuário");
                        }
                      } catch {
                        setEditError("Erro de conexão");
                      }
                      setEditLoading(false);
                    }}
                    disabled={editLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-colors disabled:opacity-60"
                    style={{ background: "hsl(207 89% 42%)", color: "#fff" }}
                  >
                    {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4 text-sm">
                  {[
                    { label: "Nome", value: drawerUser.nome_completo },
                    { label: "Email", value: drawerUser.email },
                    { label: "Órgão", value: drawerUser.orgao || "—" },
                    { label: "Status", value: drawerUser.status },
                    { label: "Cadastro", value: new Date(drawerUser.created_at).toLocaleDateString("pt-BR") },
                    { label: "Último acesso", value: drawerUser.ultimo_acesso ? new Date(drawerUser.ultimo_acesso).toLocaleDateString("pt-BR") : "—" },
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>{f.label}</p>
                      <p style={{ color: "hsl(220 13% 18%)" }}>{f.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const userTenantId = (() => {
                        const t = tenants.find((t) => t.sigla === drawerUser.orgao);
                        return t?.id || "";
                      })();
                      setEditForm({
                        nome_completo: drawerUser.nome_completo,
                        email: drawerUser.email,
                        status: drawerUser.status,
                        tenant_id: userTenantId,
                        role: drawerUser.role || "",
                      });
                      setEditError("");
                      setEditMode(true);
                    }}
                    className="px-4 py-2 rounded text-xs font-semibold border transition-colors hover:bg-gray-50"
                    style={{ borderColor: "hsl(207 89% 42%)", color: "hsl(207 89% 42%)" }}
                  >
                    Editar
                  </button>

                  {/* Activate manually */}
                  {drawerUser.status !== "ativo" && (
                    <button
                      onClick={async () => {
                        setActivateLoading(true);
                        try {
                          const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
                            body: JSON.stringify({
                              action: "activateUser",
                              session_token: sessionToken,
                              user_id: drawerUser.id,
                            }),
                          });
                          const data = await res.json();
                          if (res.ok && data.success) {
                            toast({ title: "Usuário ativado", description: "O usuário foi ativado manualmente com sucesso." });
                            setDrawerUser(null);
                            loadUsers();
                          } else {
                            toast({ title: "Erro", description: data.error || "Erro ao ativar usuário", variant: "destructive" });
                          }
                        } catch {
                          toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
                        }
                        setActivateLoading(false);
                      }}
                      disabled={activateLoading}
                      className="flex items-center gap-1 px-4 py-2 rounded text-xs font-semibold border transition-colors hover:bg-gray-50 disabled:opacity-60"
                      style={{ borderColor: "hsl(142 71% 35%)", color: "hsl(142 71% 35%)" }}
                    >
                      {activateLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      Ativar manualmente
                    </button>
                  )}

                  {/* Block / Unblock */}
                  {!blockConfirm ? (
                    <button
                      onClick={() => setBlockConfirm(true)}
                      className="px-4 py-2 rounded text-xs font-semibold border transition-colors hover:bg-gray-50"
                      style={{
                        borderColor: drawerUser.status === "bloqueado" ? "hsl(142 71% 35%)" : "hsl(0 73% 42%)",
                        color: drawerUser.status === "bloqueado" ? "hsl(142 71% 35%)" : "hsl(0 73% 42%)",
                      }}
                    >
                      {drawerUser.status === "bloqueado" ? "Desbloquear" : "Bloquear"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "hsl(0 73% 42%)" }}>
                        {drawerUser.status === "bloqueado" ? "Confirmar desbloqueio?" : "Confirmar bloqueio?"}
                      </span>
                      <button
                        onClick={async () => {
                          setBlockLoading(true);
                          try {
                            const newStatus = drawerUser.status === "bloqueado" ? "ativo" : "bloqueado";
                            const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
                              body: JSON.stringify({
                                action: "updateUserStatus",
                                session_token: sessionToken,
                                user_id: drawerUser.id,
                                status: newStatus,
                              }),
                            });
                            const data = await res.json();
                            if (res.ok && data.success) {
                              toast({
                                title: newStatus === "bloqueado" ? "Usuário bloqueado" : "Usuário desbloqueado",
                                description: newStatus === "bloqueado" ? "O acesso do usuário foi bloqueado." : "O acesso do usuário foi restaurado.",
                              });
                              setDrawerUser(null);
                              setBlockConfirm(false);
                              loadUsers();
                            }
                          } catch {}
                          setBlockLoading(false);
                        }}
                        disabled={blockLoading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-white disabled:opacity-60"
                        style={{ background: drawerUser.status === "bloqueado" ? "hsl(142 71% 35%)" : "hsl(0 73% 42%)" }}
                      >
                        {blockLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                        Sim
                      </button>
                      <button
                        onClick={() => setBlockConfirm(false)}
                        className="px-3 py-1.5 rounded text-xs border"
                        style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 9% 46%)" }}
                      >
                        Não
                      </button>
                    </div>
                  )}
                </div>

                {/* Delete user */}
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "hsl(220 13% 91%)" }}>
                  {!deleteConfirm ? (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      className="px-4 py-2 rounded text-xs font-semibold border transition-colors hover:bg-red-50"
                      style={{ borderColor: "hsl(0 73% 42%)", color: "hsl(0 73% 42%)" }}
                    >
                      Remover usuário
                    </button>
                  ) : (
                    <div className="rounded-md border p-3 space-y-2" style={{ borderColor: "hsl(0 73% 42% / 0.3)", background: "hsl(0 73% 42% / 0.04)" }}>
                      <p className="text-xs font-medium" style={{ color: "hsl(0 73% 42%)" }}>
                        Tem certeza que deseja remover permanentemente este usuário?
                      </p>
                      <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                        Esta ação não pode ser desfeita. Todos os dados associados serão removidos.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setDeleteLoading(true);
                            try {
                              const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
                                body: JSON.stringify({
                                  action: "deleteUser",
                                  session_token: sessionToken,
                                  user_id: drawerUser.id,
                                }),
                              });
                              const data = await res.json();
                              if (res.ok && data.success) {
                                toast({ title: "Usuário removido", description: "O usuário foi removido permanentemente." });
                                setDrawerUser(null);
                                setDeleteConfirm(false);
                                loadUsers();
                              } else {
                                toast({ title: "Erro", description: data.error || "Erro ao remover", variant: "destructive" });
                              }
                            } catch {
                              toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
                            }
                            setDeleteLoading(false);
                          }}
                          disabled={deleteLoading}
                          className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-white disabled:opacity-60"
                          style={{ background: "hsl(0 73% 42%)" }}
                        >
                          {deleteLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                          Sim, remover
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          className="px-3 py-1.5 rounded text-xs border"
                          style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 9% 46%)" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Create User Dialog */}
      {showCreateDialog && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setShowCreateDialog(false)} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-lg border p-6"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
                Novo Usuário
              </h2>
              <button onClick={() => setShowCreateDialog(false)}>
                <X className="w-5 h-5" style={{ color: "hsl(220 9% 46%)" }} />
              </button>
            </div>

            {createSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center" style={{ background: "hsl(142 71% 45% / 0.1)" }}>
                  <svg className="w-6 h-6" style={{ color: "hsl(142 71% 45%)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: "hsl(220 13% 18%)" }}>Usuário criado com sucesso!</p>
                <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                  Um email de convite foi enviado para <strong>{createForm.email}</strong> com instruções para configurar a senha.
                </p>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="px-4 py-2 rounded text-sm font-semibold mt-2"
                  style={{ background: "hsl(207 89% 42%)", color: "#fff" }}
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4">
                {createError && (
                  <div className="rounded-md border p-3 text-xs" style={{ background: "hsl(0 73% 42% / 0.06)", borderColor: "hsl(0 73% 42% / 0.2)", color: "hsl(0 73% 42%)" }}>
                    {createError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Nome completo *</label>
                  <input
                    type="text"
                    value={createForm.nome_completo}
                    onChange={(e) => setCreateForm((f) => ({ ...f, nome_completo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                    placeholder="Nome do usuário"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Email *</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none focus:ring-1"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                    placeholder="email@orgao.gov.br"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Órgão *</label>
                  <select
                    value={createForm.tenant_id}
                    onChange={(e) => setCreateForm((f) => ({ ...f, tenant_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none cursor-pointer"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                  >
                    <option value="">Selecione o órgão</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.sigla} — {t.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "hsl(220 9% 46%)" }}>Papel</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-md border text-sm outline-none cursor-pointer"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 13% 18%)" }}
                   >
                    {isAdministrador && <option value="super_administrador">Super Administrador</option>}
                    {isAdministrador && <option value="administrador">Administrador</option>}
                    <option value="admin_master">Técnico</option>
                    <option value="operador">Operacional</option>
                    <option value="admin_tenant">Administrador do Órgão</option>
                    <option value="suporte">Suporte</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(false)}
                    className="px-4 py-2 rounded text-sm border transition-colors hover:bg-gray-50"
                    style={{ borderColor: "hsl(220 13% 87%)", color: "hsl(220 9% 46%)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-60"
                    style={{ background: "hsl(207 89% 42%)", color: "#fff" }}
                  >
                    {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Criar e enviar convite
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
