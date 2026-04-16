import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { fonarService } from "@/services/fonarService";

export default function FonarHistorico() {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fonarService.history()
      .then((r) => setVersions(r.versions || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in max-w-2xl mx-auto py-6 px-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-display">FONAR</p>
        <h1 className="text-2xl font-bold font-display">Histórico de versões</h1>
      </div>

      {loading ? (
        <div className="ampara-card h-32 animate-pulse" />
      ) : versions.length === 0 ? (
        <div className="ampara-card p-6 text-center">
          <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma versão registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div key={v.id} className="ampara-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Versão {v.versao}</p>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {v.origem}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(v.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
