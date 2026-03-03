import { useNavigate } from "react-router-dom";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";
import GradientIcon from "@/components/ui/gradient-icon";
import { UserSearch } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in space-y-6 min-h-full max-w-4xl">
      {/* Azure-style page header */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Dashboard</p>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Visão geral</h1>
      </div>

      <div className="space-y-4">
        <RiskEvolutionCard />
        <DeviceStatusCard />
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate("/busca-perfil")}
            className="ampara-card flex items-center gap-2 w-full text-left transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer p-3"
          >
            <GradientIcon icon={UserSearch} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Pesquisar parceiro</p>
              <p className="text-xs text-muted-foreground">Consultar perfil</p>
            </div>
          </button>
          <AudioRecorderCard />
        </div>
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
