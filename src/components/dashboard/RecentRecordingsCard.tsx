import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { Mic, Clock, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Gravacao {
  id: string;
  created_at: string;
  duracao_segundos: number | null;
  status: string;
  tamanho_mb: number | null;
}

function formatDuration(s: number | null): string {
  if (!s) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const statusLabels: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-yellow-500/15 text-yellow-700" },
  processado: { label: "Processado", className: "bg-green-500/15 text-green-700" },
  erro: { label: "Erro", className: "bg-destructive/15 text-destructive" },
};

export default function RecentRecordingsCard() {
  const { sessionToken } = useAuth();
  const navigate = useNavigate();
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await callWebApi("getGravacoes", sessionToken, { page: 1, per_page: 3 });
      if (res.ok) setGravacoes(res.data.gravacoes || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchRecordings(); }, [sessionToken]);

  if (!sessionToken) return null;

  return (
    <div className="ampara-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Últimas gravações</h3>
        <button
          onClick={() => navigate("/gravacoes")}
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          Ver todas <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : gravacoes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma gravação ainda</p>
      ) : (
        <div className="space-y-2">
          {gravacoes.map((g) => {
            const st = statusLabels[g.status] || statusLabels.pendente;
            return (
              <div
                key={g.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
                onClick={() => navigate("/gravacoes")}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Mic className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {formatDate(g.created_at)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${st.className}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(g.duracao_segundos)}</span>
                    {g.tamanho_mb && <span>· {g.tamanho_mb.toFixed(1)} MB</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
