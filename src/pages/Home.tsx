import { useNavigate } from "react-router-dom";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";
import GradientIcon from "@/components/ui/gradient-icon";
import { UserSearch, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const firstName = (usuario?.nome_completo || "").split(" ")[0];

  return (
    <div className="animate-fade-in space-y-5 min-h-full max-w-4xl">
      {/* Hero welcome banner — dark gradient inspired by reference */}
      <div className="ampara-hero-banner">
        <div className="relative z-10">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">
              {firstName ? `Olá, ${firstName}` : "Visão geral"}
            </h1>
            <p className="text-xs md:text-sm text-white/60 mt-0.5">
              Sua proteção está ativa. Confira o resumo abaixo.
            </p>
          </div>
        </div>
      </div>

      {/* Risk evolution — accent card */}
      <RiskEvolutionCard />

      {/* Device status */}
      <DeviceStatusCard />

      {/* Action cards row */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/busca-perfil")}
          className="ampara-card-accent flex items-center gap-3 w-full text-left cursor-pointer group"
        >
          <div className="p-3 md:p-4 flex items-center gap-3 w-full">
            <GradientIcon icon={UserSearch} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Pesquisar parceiro</p>
              <p className="text-[11px] text-muted-foreground">Consultar perfil</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
          </div>
        </button>
        <AudioRecorderCard />
      </div>

      {/* Monitoring */}
      <MonitoringStatusCard />
    </div>
  );
}
