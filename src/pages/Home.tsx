import DeviceStatusCard from "@/components/dashboard/DeviceStatusCard";
import AudioRecorderCard from "@/components/dashboard/AudioRecorderCard";
import RiskEvolutionCard from "@/components/dashboard/RiskEvolutionCard";
import amparaCircle from "@/assets/ampara-circle-logo.png";

export default function HomePage() {
  return (
    <div className="relative animate-fade-in overflow-hidden space-y-6">
      {/* Background watermark */}
      <img
        src={amparaCircle}
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed bottom-[-15%] left-1/2 -translate-x-1/2 w-[280vw] max-w-none opacity-30 z-0 select-none"
      />

      <div className="relative z-10 space-y-4">
        <h1 className="text-lg font-display font-bold text-foreground">Dashboard</h1>
        <RiskEvolutionCard />
        <DeviceStatusCard />
        <AudioRecorderCard />
      </div>
    </div>
  );
}
