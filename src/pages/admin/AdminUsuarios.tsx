import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";
import { Plus, X } from "lucide-react";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

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

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("usuarios")
        .select("id, nome_completo, email, status, ultimo_acesso, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setUsers((data as UserRow[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const statusMap: Record<string, "verde" | "amarelo" | "laranja" | "vermelho"> = {
    ativo: "verde",
    pendente: "amarelo",
    inativo: "laranja",
    bloqueado: "vermelho",
  };

  return (
    <div style={fontStyle} className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Usuários</p>
          <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Usuários</h1>
        </div>
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-semibold transition-colors"
          style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
        >
          <Plus className="w-4 h-4" /> Novo Usuário
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
