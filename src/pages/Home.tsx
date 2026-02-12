import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";

export default function HomePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
      <RiskEvolutionCard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DeviceStatusCard />
        <AudioRecorderCard />
      </div>
      <MonitoringStatusCard />
    </div>
  );
}
