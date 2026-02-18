import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";
import { Plus, X, Search, ChevronLeft, ChevronRight } from "lucide-react";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };
const PAGE_SIZE = 50;

interface UserRow {
  id: string;
  nome_completo: string;
  email: string;
  status: string;
  ultimo_acesso: string | null;
  created_at: string;
}

export default function AdminUsuarios() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerUser, setDrawerUser] = useState<UserRow | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

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

      const { data, count } = await query;
      setUsers((data as UserRow[]) || []);
      setTotalCount(count || 0);
      setLoading(false);
    }
    load();
  }, [debouncedSearch, statusFilter, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const statusMap: Record<string, "verde" | "amarelo" | "laranja" | "vermelho"> = {
    ativo: "verde",
    pendente: "amarelo",
    inativo: "laranja",
    bloqueado: "vermelho",
  };

  return (
    <div style={fontStyle} className="relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Usuários</p>
          <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Usuários</h1>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md border flex-1 sm:flex-initial sm:w-72"
            style={{ borderColor: "hsl(220 13% 87%)", background: "hsl(210 17% 98%)" }}
          >
            <Search className="w-4 h-4 shrink-0" style={{ color: "hsl(220 9% 46%)" }} />
            <input
              type="text"
              placeholder="Buscar por nome ou email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm w-full"
              style={{ color: "hsl(220 13% 18%)" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="shrink-0">
                <X className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} />
              </button>
            )}
          </div>
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-colors shrink-0"
            style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
          >
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
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
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
            style={{
              borderColor: statusFilter === f.value ? "hsl(224 76% 33%)" : "hsl(220 13% 87%)",
              background: statusFilter === f.value ? "hsl(224 76% 33%)" : "transparent",
              color: statusFilter === f.value ? "#fff" : "hsl(220 9% 46%)",
            }}
          >
            {f.label}
          </button>
        ))}
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
                {["Nome", "Email", "Status", "Último login", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "hsl(220 9% 46%)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "hsl(220 9% 46%)" }}>
                    Carregando…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "hsl(220 9% 46%)" }}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: "hsl(220 13% 91%)" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "hsl(220 13% 18%)" }}>{u.nome_completo}</td>
                    <td className="px-4 py-3" style={{ color: "hsl(220 9% 46%)" }}>{u.email}</td>
                    <td className="px-4 py-3">
                      <GovStatusBadge status={statusMap[u.status] || "amarelo"} label={u.status} />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                      {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDrawerUser(u)}
                        className="text-xs font-medium px-3 py-1 rounded border transition-colors hover:bg-gray-50"
                        style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>
            {totalCount} registro{totalCount !== 1 ? "s" : ""} · Página {page + 1} de {totalPages}
          </p>
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
              if (totalPages <= 5) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className="w-8 h-8 rounded border text-xs font-medium transition-colors"
                  style={{
                    borderColor: page === pageNum ? "hsl(224 76% 33%)" : "hsl(220 13% 87%)",
                    background: page === pageNum ? "hsl(224 76% 33%)" : "transparent",
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
        </div>
      )}

      {/* Drawer */}
      {drawerUser && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setDrawerUser(null)} />
          <div
            className="fixed right-0 top-0 h-full w-full max-w-md z-50 border-l overflow-y-auto p-6"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
                Detalhes do Usuário
              </h2>
              <button onClick={() => setDrawerUser(null)}>
                <X className="w-5 h-5" style={{ color: "hsl(220 9% 46%)" }} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {[
                { label: "Nome", value: drawerUser.nome_completo },
                { label: "Email", value: drawerUser.email },
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

            <div className="mt-6 flex gap-2">
              <button
                className="px-4 py-2 rounded text-xs font-semibold border transition-colors hover:bg-gray-50"
                style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
              >
                Editar
              </button>
              <button
                className="px-4 py-2 rounded text-xs font-semibold border transition-colors hover:bg-gray-50"
                style={{ borderColor: "hsl(0 73% 42%)", color: "hsl(0 73% 42%)" }}
              >
                Bloquear
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
