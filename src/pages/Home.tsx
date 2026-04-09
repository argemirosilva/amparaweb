import { useNavigate } from "react-router-dom";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";
import { UserSearch, ChevronRight, User, Shield, Mic, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import GradientIcon from "@/components/ui/gradient-icon";

export default function HomePage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const firstName = (usuario?.nome_completo || "").split(" ")[0];

  return (
    <div className="animate-fade-in min-h-full max-w-4xl pb-6">

      {/* Main content */}
      <div className="space-y-3 px-1">
        {/* Risk evolution */}
        <RiskEvolutionCard />

        {/* Device status */}
        <DeviceStatusCard />

        {/* Quick actions - organic card */}
        <div className="rounded-2xl bg-card border border-border/60 overflow-hidden"
          style={{ boxShadow: "0 1px 3px 0 hsl(320 40% 30% / 0.04), 0 4px 16px -4px hsl(280 40% 30% / 0.06)" }}>
          <button
            onClick={() => navigate("/busca-perfil")}
            className="flex items-center gap-3 w-full text-left px-4 py-3.5 hover:bg-muted/50 active:bg-muted transition-colors"
          >
            <GradientIcon icon={UserSearch} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Pesquisar parceiro</p>
              <p className="text-[11px] text-muted-foreground">Consultar perfil e histórico</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
          </button>

          <div className="h-px bg-border/40 mx-4" />

          {/* Audio recorder inline */}
          <div className="px-4 py-3">
            <AudioRecorderCard />
          </div>
        </div>

        {/* Monitoring */}
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
