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

        {/* Device status + Quick actions side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DeviceStatusCard />

          {/* Quick actions card - matching DeviceStatusCard style */}
          <div className="ampara-card p-5 flex flex-col">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Ações rápidas</p>

            <div className="space-y-2.5 flex-1">
              {/* Pesquisar parceiro */}
              <div className="rounded-xl border border-border/60 bg-background/50">
                <button
                  onClick={() => navigate("/busca-perfil")}
                  className="flex items-center gap-2.5 w-full text-left px-3.5 py-3 hover:bg-muted/50 active:bg-muted transition-colors rounded-xl"
                >
                  <GradientIcon icon={UserSearch} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Pesquisar parceiro</p>
                    <p className="text-[11px] text-muted-foreground">Consultar perfil e histórico</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                </button>
              </div>

              {/* Audio recorder */}
              <div className="rounded-xl border border-border/60 bg-background/50 px-3.5 py-3">
                <AudioRecorderCard />
              </div>
            </div>
          </div>
        </div>

        {/* Monitoring */}
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
