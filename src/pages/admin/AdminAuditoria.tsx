import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { X, CalendarIcon, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminTableWrapper from "@/components/admin/AdminTableWrapper";

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
  const [filterUserText, setFilterUserText] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterAction !== "all") {
        query = query.eq("action_type", filterAction);
      } else {
        query = query.in("action_type", ADMIN_ACTION_TYPES);
      }

      if (dateFrom) {
        query = query.gte("created_at", dateFrom.toISOString());
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
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
  }, [filterAction, dateFrom, dateTo]);

  return (
    <div>
      <AdminPageHeader
        icon={ClipboardCheck}
        breadcrumb="Admin › Auditoria"
        title="Auditoria Administrativa"
        description="Registros de ações realizadas por administradores"
      />

      <AdminFilterBar>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="text-sm rounded-md border border-border px-3 py-2 outline-none bg-background text-foreground"
        >
          <option value="all">Todas as ações</option>
          {ADMIN_ACTION_TYPES.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
          ))}
        </select>
        <input
          type="text"
          value={filterUserText}
          onChange={(e) => setFilterUserText(e.target.value)}
          placeholder="Filtrar por nome do usuário…"
          className="text-sm rounded-md border border-border px-3 py-2 outline-none w-64 bg-background text-foreground"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("text-sm h-9 px-3 justify-start font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data inicial"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("text-sm h-9 px-3 justify-start font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data final"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} className="text-xs font-medium px-2 py-1 rounded text-destructive">
            Limpar datas
          </button>
        )}
      </AdminFilterBar>

      <AdminTableWrapper>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {["Data/hora", "Usuário", "Ação", "IP", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            ) : (() => {
              const filtered = filterUserText.trim()
                ? logs.filter((l) => l.user_name?.toLowerCase().includes(filterUserText.toLowerCase()))
                : logs;
              return filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {l.user_name || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {ACTION_LABELS[l.action_type] || l.action_type}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                    {l.ip_address || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: l.success ? "hsl(var(--risco-sem-risco))" : "hsl(var(--destructive))" }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(l)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Ver detalhes
                    </button>
                  </td>
                </tr>
              ))
            ); })()}
          </tbody>
        </table>
      </AdminTableWrapper>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelected(null)}>
          <div
            className="rounded-lg border border-border bg-card p-6 max-w-lg w-full mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">
                Detalhes do Registro
              </h2>
              <button onClick={() => setSelected(null)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Ação</p>
                <p className="text-foreground">{selected.action_type}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Data/hora</p>
                <p className="text-foreground">{new Date(selected.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Metadata</p>
                <pre className="text-xs p-3 rounded overflow-auto max-h-40 bg-muted text-foreground">
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
