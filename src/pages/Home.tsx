import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import MonitoringStatusCard from "@/components/dashboard/MonitoringStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RecentRecordingsCard from "@/components/dashboard/RecentRecordingsCard";

export default function HomePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
      <AudioRecorderCard />
      <RecentRecordingsCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DeviceStatusCard />
        <MonitoringStatusCard />
      </div>
    </div>
  );
}
