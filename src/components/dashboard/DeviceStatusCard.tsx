import { useDeviceStatus } from "@/hooks/useDeviceStatus";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Smartphone,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";

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
        <Badge variant="secondary" className="shrink-0 gap-1 bg-muted text-muted-foreground">
          <WifiOff className="w-3 h-3" /> Offline
        </Badge>
      </div>
    );
  }

  const online = isOnline(device.last_ping_at);

  return (
    <div className="ampara-card flex items-center gap-4 p-4">
      {/* Icon */}
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
        <Smartphone className="w-6 h-6 text-primary" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary">Dispositivo</p>
        <p className="text-sm text-foreground truncate">
          {device.dispositivo_info || "App móvel Ampara"}
        </p>
        {device.last_ping_at && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {timeSince(device.last_ping_at)}
          </p>
        )}
      </div>

      {/* Status badge */}
      {online ? (
        <Badge className="shrink-0 gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
          <Wifi className="w-3 h-3" /> Online
        </Badge>
      ) : (
        <Badge variant="secondary" className="shrink-0 gap-1 bg-muted text-muted-foreground">
          <WifiOff className="w-3 h-3" /> Offline
        </Badge>
      )}
    </div>
  );
}
