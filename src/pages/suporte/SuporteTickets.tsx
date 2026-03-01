import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { callSupportApi } from "@/services/supportApiService";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ticketCode } from "@/lib/redactPii";

const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  waiting_user: "Aguardando Usuária",
  waiting_consent: "Aguardando Consentimento",
  active: "Ativo",
  closed: "Encerrado",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  waiting_user: "bg-yellow-100 text-yellow-700",
  waiting_consent: "bg-orange-100 text-orange-700",
  active: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  app_issue: "Problema no App",
  playback: "Reprodução",
  upload: "Upload",
  gps: "GPS",
  notifications: "Notificações",
  account: "Conta",
  recording_question: "Dúvida Gravação",
  transcription_question: "Dúvida Transcrição",
  analysis_question: "Dúvida Análise",
  other: "Outro",
};

export default function SuporteTickets() {
  const { sessionToken } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchSessions = async () => {
    if (!sessionToken) return;
    setLoading(true);
    const params: any = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (categoryFilter !== "all") params.category = categoryFilter;
    const { ok, data } = await callSupportApi("listSessions", sessionToken, params);
    if (ok) setSessions(data.sessions || []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, [sessionToken, statusFilter, categoryFilter]);

  const filtered = sessions.filter((s) => {
    if (!search) return true;
    const code = ticketCode(s.id).toLowerCase();
    const cat = (CATEGORY_LABELS[s.category] || s.category).toLowerCase();
    return code.includes(search.toLowerCase()) || cat.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "hsl(220 13% 18%)" }}>Suporte Técnico</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por código ou categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sessions list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum ticket encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/admin/suporte/${s.id}`)}
              className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:shadow-sm transition-shadow"
              style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm font-mono" style={{ color: "hsl(220 13% 18%)" }}>
                    {ticketCode(s.id)}
                  </span>
                  <Badge variant="outline" className={STATUS_COLORS[s.status] || ""}>
                    {STATUS_LABELS[s.status] || s.status}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_LABELS[s.category] || s.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(s.last_activity_at), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
