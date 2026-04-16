import { useNavigate } from "react-router-dom";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";
import AmparaPresenceCard from "@/components/dashboard/AmparaPresenceCard";
import FonarHomeBlock from "@/components/fonar/FonarHomeBlock";
import { UserSearch, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  return (
    <div className="animate-fade-in min-h-full max-w-4xl pb-6">
      <div className="space-y-4 px-1">
        {/* Ampara presence — contextual greeting */}
        <AmparaPresenceCard />

        {/* Risk evolution — hero card */}
        <RiskEvolutionCard />

        {/* Device + Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DeviceStatusCard />

          {/* Quick actions */}
          <div className="ampara-card p-5 flex flex-col">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 font-display">
              Ações rápidas
            </p>

            <div className="space-y-3 flex-1">
              {/* Search partner */}
              <button
                onClick={() => navigate("/busca-perfil")}
                className="flex items-center gap-3 w-full text-left p-4 rounded-2xl border border-border bg-background hover:bg-muted/50 active:scale-[0.98] transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center shrink-0">
                  <UserSearch className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Pesquisar parceiro</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Consultar perfil e histórico</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
              </button>

              {/* Audio recorder */}
              <div className="p-4 rounded-2xl border border-border bg-background">
                <AudioRecorderCard />
              </div>
            </div>
          </div>
        </div>

        {/* Monitoring */}
        <MonitoringStatusCard />

        {/* FONAR — módulo observador independente */}
        <FonarHomeBlock />
      </div>
    </div>
  );
}
