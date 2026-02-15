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
        <Button
          onClick={() => navigate("/busca-perfil")}
          variant="outline"
          className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
        >
          <Search className="w-4 h-4" />
          Pesquisar perfil do agressor
        </Button>
        <DeviceStatusCard />
        <AudioRecorderCard />
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
