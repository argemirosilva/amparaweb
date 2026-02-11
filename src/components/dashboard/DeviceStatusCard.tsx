import { useDeviceStatus } from "@/hooks/useDeviceStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { Smartphone, Clock, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging } from "lucide-react";
import badgeOnline from "@/assets/badge-online.png";
import badgeOffline from "@/assets/badge-offline.png";

function timeSince(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `Há ${s}s`;
  if (s < 3600) return `Há ${Math.floor(s / 60)} min`;
  return `Há ${Math.floor(s / 3600)}h`;
}

function isOnline(lastPing: string | null): boolean {
  if (!lastPing) return false;
  return Date.now() - new Date(lastPing).getTime() < 45_000;
}

function BatteryIndicator({ percent, charging }: { percent: number | null; charging: boolean | null }) {
  if (percent === null) return null;

  const Icon = charging
    ? BatteryCharging
    : percent > 60
      ? BatteryFull
      : percent > 20
        ? BatteryMedium
        : BatteryLow;

  const color = charging
    ? "text-primary"
    : percent > 60
      ? "text-primary"
      : percent > 20
        ? "text-muted-foreground"
        : "text-destructive";

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {percent}%
    </span>
  );
}

export default function DeviceStatusCard() {
  const { device, loading, error } = useDeviceStatus();

  if (loading) {
    return (
      <div className="ampara-card">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="ampara-card flex items-center gap-4 p-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary">Dispositivo</p>
          <p className="text-sm text-muted-foreground truncate">
            {error || "Nenhum dado recebido"}
          </p>
        </div>
        <img src={badgeOffline} alt="Offline" className="h-3.5 shrink-0" />
      </div>
    );
  }

  const online = isOnline(device.last_ping_at);

  return (
    <div className="ampara-card flex items-center gap-4 p-4 relative overflow-hidden">
      {/* Monitoring ear */}
      {device.is_monitoring && (
        <div className="absolute top-0 right-0 flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-medium pl-2 pr-2.5 py-0.5 rounded-bl-lg">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Monitorando
        </div>
      )}

      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
        <Smartphone className="w-6 h-6 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary">Dispositivo</p>
        <p className="text-sm text-foreground truncate">
          {device.dispositivo_info || "App móvel Ampara"}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          {device.last_ping_at && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeSince(device.last_ping_at)}
            </span>
          )}
          <BatteryIndicator percent={device.bateria_percentual} charging={device.is_charging} />
        </div>
      </div>

      {online ? (
        <img src={badgeOnline} alt="Online" className="h-3.5 shrink-0" />
      ) : (
        <img src={badgeOffline} alt="Offline" className="h-3.5 shrink-0" />
      )}
    </div>
  );
}
