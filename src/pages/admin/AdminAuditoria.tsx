import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const ADMIN_ACTION_TYPES = [
  "admin_login",
  "admin_atualizar_setting",
  "admin_criar_orgao",
  "admin_gerar_relatorio",
  "admin_update_user",
  "admin_visualizar_usuarios",
  "alterar_configuracao",
  "login_success",
  "session_created",
  "login_failed",
  "logout",
];

const ACTION_LABELS: Record<string, string> = {
  admin_login: "Login Admin",
  admin_atualizar_setting: "Alterou Configuração",
  admin_criar_orgao: "Criou Órgão",
  admin_gerar_relatorio: "Gerou Relatório",
  admin_update_user: "Alterou Usuário",
  admin_visualizar_usuarios: "Visualizou Usuários",
  alterar_configuracao: "Alterou Configuração",
  login_success: "Login",
  session_created: "Sessão Criada",
  login_failed: "Falha de Login",
  logout: "Logout",
};

interface AuditRow {
  id: string;
  created_at: string;
  user_id: string | null;
  action_type: string;
  ip_address: string | null;
  details: any;
  success: boolean;
  user_name?: string;
}

export default function AdminAuditoria() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [filterAction, setFilterAction] = useState<string>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("audit_logs")
        .select("*")
        .in("action_type", ADMIN_ACTION_TYPES)
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterAction !== "all") {
        query = supabase
          .from("audit_logs")
          .select("*")
          .eq("action_type", filterAction)
          .order("created_at", { ascending: false })
          .limit(200);
      }

      const { data } = await query;
      const rows = (data as AuditRow[]) || [];

      // Fetch user names for all unique user_ids
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("usuarios")
          .select("id, nome_completo, email")
          .in("id", userIds);
        if (users) {
          for (const u of users) {
            userMap[u.id] = u.nome_completo || u.email;
          }
        }
      }

      setLogs(rows.map((r) => ({ ...r, user_name: r.user_id ? userMap[r.user_id] || "—" : "—" })));
      setLoading(false);
    }
    load();
  }, [filterAction]);

  return (
    <div style={fontStyle}>
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Auditoria</p>
        <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Auditoria Administrativa</h1>
        <p className="text-sm mt-1" style={{ color: "hsl(220 9% 46%)" }}>Registros de ações realizadas por administradores</p>
      </div>

      <div className="mb-4">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-sm rounded-md border px-3 py-2 outline-none"
          style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 13% 18%)", fontFamily: "Inter, Roboto, sans-serif" }}
        >
          <option value="all">Todas as ações admin</option>
          {ADMIN_ACTION_TYPES.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
      </div>

      <div
        className="rounded-md border overflow-hidden"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(210 17% 96%)" }}>
                {["Data/hora", "Usuário", "Ação", "IP", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold" style={{ color: "hsl(220 9% 46%)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "hsl(220 9% 46%)" }}>
                    Carregando…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "hsl(220 9% 46%)" }}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-t" style={{ borderColor: "hsl(220 13% 91%)" }}>
                    <td className="px-4 py-3 text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "hsl(220 13% 18%)" }}>
                      {l.user_name || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                      {ACTION_LABELS[l.action_type] || l.action_type}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "hsl(220 9% 46%)" }}>
                      {l.ip_address || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: l.success ? "hsl(142 64% 24%)" : "hsl(0 73% 42%)" }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(l)}
                        className="text-xs font-medium"
                        style={{ color: "hsl(224 76% 33%)" }}
                      >
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelected(null)}>
          <div
            className="rounded-md border p-6 max-w-lg w-full mx-4"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
                Detalhes do Registro
              </h2>
              <button onClick={() => setSelected(null)}>
                <X className="w-5 h-5" style={{ color: "hsl(220 9% 46%)" }} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Ação</p>
                <p style={{ color: "hsl(220 13% 18%)" }}>{selected.action_type}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Data/hora</p>
                <p style={{ color: "hsl(220 13% 18%)" }}>{new Date(selected.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Metadata</p>
                <pre
                  className="text-xs p-3 rounded overflow-auto max-h-40"
                  style={{ background: "hsl(210 17% 96%)", color: "hsl(220 13% 18%)" }}
                >
                  {JSON.stringify(selected.details, null, 2) || "—"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
