import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";

export default function HomePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
      <DeviceStatusCard />
      <AudioRecorderCard />
      <MonitoringStatusCard />
    </div>
  );
}
