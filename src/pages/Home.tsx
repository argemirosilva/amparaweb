import { useNavigate } from "react-router-dom";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";
import PageHeader from "@/components/ui/page-header";
import { UserSearch, ChevronRight, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const firstName = (usuario?.nome_completo || "").split(" ")[0];

  return (
    <div className="animate-fade-in min-h-full max-w-4xl pb-6">
      {/* Greeting header with decorative background */}
      <PageHeader tag="Início" title={`Bem-vinda, ${firstName || "Minha conta"}`}>
        <div className="flex items-center gap-2">
          {usuario?.avatar_url ? (
            <img
              src={usuario.avatar_url}
              alt=""
              className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-white/50"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </PageHeader>


      {/* Main content - stacked sections */}
      <div className="space-y-3 px-1">
        {/* Device status - primary card */}
        <DeviceStatusCard />

        {/* Risk evolution */}
        <RiskEvolutionCard />

        {/* Quick actions - native list style */}
        <div className="rounded-xl bg-card border border-border/60 divide-y divide-border/40 overflow-hidden">
          <button
            onClick={() => navigate("/busca-perfil")}
            className="flex items-center gap-3 w-full text-left px-4 py-3.5 hover:bg-muted/50 active:bg-muted transition-colors"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ampara-gradient-soft)" }}>
              <UserSearch className="w-[18px] h-[18px]" style={{ color: "hsl(var(--ampara-magenta))" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Pesquisar parceiro</p>
              <p className="text-[12px] text-muted-foreground">Consultar perfil e histórico</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          </button>

          {/* Audio recorder inline */}
          <div className="px-4 py-3">
            <AudioRecorderCard />
          </div>
        </div>

        {/* Monitoring - bottom */}
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
