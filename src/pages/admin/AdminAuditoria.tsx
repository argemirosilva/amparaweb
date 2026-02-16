import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

interface AuditRow {
  id: string;
  created_at: string;
  user_id: string | null;
  action_type: string;
  ip_address: string | null;
  details: any;
  success: boolean;
}

export default function AdminAuditoria() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((data as AuditRow[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div style={fontStyle}>
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Auditoria</p>
        <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Auditoria</h1>
      </div>

      <div
        className="rounded-md border overflow-hidden"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(210 17% 96%)" }}>
                {["Data/hora", "Ação", "IP", "Status", ""].map((h) => (
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
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: "hsl(220 9% 46%)" }}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-t" style={{ borderColor: "hsl(220 13% 91%)" }}>
                    <td className="px-4 py-3 text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                      {l.action_type}
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
