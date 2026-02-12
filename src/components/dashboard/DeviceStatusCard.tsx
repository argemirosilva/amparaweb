import { useState } from "react";
import { useDeviceStatus } from "@/hooks/useDeviceStatus";
import { Skeleton } from "@/components/ui/skeleton";
import { Smartphone, Clock, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Wifi, WifiOff, MapPin, X } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";

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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function DeviceStatusCard() {
  const { device, location, geo, addressLoading, loading, error } = useDeviceStatus();
  const [showMap, setShowMap] = useState(false);

  if (loading) {
    return (
      <div className="ampara-card p-5">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const online = device ? isOnline(device.last_ping_at) : false;
  const noDevice = error || !device;

  return (
    <>
      <div className="ampara-card p-5 relative overflow-hidden">
        {/* Monitoring indicator */}
        {device?.is_monitoring && (
          <div className="absolute top-0 right-0 flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-medium pl-2 pr-2.5 py-0.5 rounded-bl-lg">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Monitorando
          </div>
        )}

        {/* Icon */}
        <GradientIcon icon={Smartphone} size="sm" />

        {/* Title + device name */}
        <p className="text-sm font-semibold text-primary mb-0.5 truncate">
          {noDevice
            ? (error || "Nenhum dispositivo")
            : (device.dispositivo_info || "App móvel Ampara")}
        </p>

        {/* Status badge row */}
        <div className="flex items-center justify-between gap-2">
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
              online
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {online ? <Wifi className="w-2 h-2" /> : <WifiOff className="w-2 h-2" />}
            {online ? "Online" : "Offline"}
          </span>

          {/* GPS button - always visible */}
          <button
            onClick={() => setShowMap(true)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
            title="Ver localização"
          >
            <MapPin className="w-3.5 h-3.5" />
            GPS
          </button>
        </div>

        {/* Meta row */}
        {device && (
          <div className="flex items-center gap-3 mt-1.5">
            {device.last_ping_at && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeSince(device.last_ping_at)}
              </span>
            )}
            <BatteryIndicator percent={device.bateria_percentual} charging={device.is_charging} />
          </div>
        )}
      </div>

      {/* Location overlay */}
      {showMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowMap(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Última localização</span>
              </div>
              <button onClick={() => setShowMap(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {location ? (
                <div className="space-y-3">
                  {/* Map image via OSM static */}
                  <div className="rounded-xl overflow-hidden border border-border">
                    <iframe
                      title="Localização"
                      width="100%"
                      height="200"
                      style={{ border: 0 }}
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.003},${location.latitude - 0.002},${location.longitude + 0.003},${location.latitude + 0.002}&layer=mapnik&marker=${location.latitude},${location.longitude}`}
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-1">
                    <p className="text-sm text-foreground font-medium">
                      {addressLoading ? "Localizando endereço..." : (geo?.display_address || "Endereço indisponível")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDateTime(location.created_at)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                      {location.precisao_metros != null && ` · ±${Math.round(location.precisao_metros)}m`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <MapPin className="w-8 h-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground text-center">Nenhuma localização recebida</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
