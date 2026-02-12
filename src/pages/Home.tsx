import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";

export default function HomePage() {
  return (
    <div className="animate-fade-in space-y-6 min-h-full">
      <div className="space-y-4">
        <RiskEvolutionCard />
        <DeviceStatusCard />
        <AudioRecorderCard />
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
