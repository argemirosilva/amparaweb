import { useNavigate } from "react-router-dom";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in space-y-6 min-h-full">
      <div className="space-y-4">
        <RiskEvolutionCard />
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-1 gap-3 items-stretch">
          <DeviceStatusCard />
          <Button
            onClick={() => navigate("/busca-perfil")}
            variant="outline"
            className="sm:hidden h-auto gap-1.5 border-primary/30 text-primary hover:bg-primary/10 flex-col px-4 min-w-[90px]"
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] leading-tight text-center">Pesquisar<br/>parceiro</span>
          </Button>
        </div>
        <Button
          onClick={() => navigate("/busca-perfil")}
          variant="outline"
          className="hidden sm:flex w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Search className="w-4 h-4" />
          Pesquisar parceiro
        </Button>
        <AudioRecorderCard />
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
