import { useState, useEffect, useRef } from "react";
import { useDeviceStatus } from "@/hooks/useDeviceStatus";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Smartphone, Clock, BatteryFull, BatteryMedium, BatteryLow, BatteryCharging, Wifi, WifiOff, MapPin, X, Mic, AlertTriangle } from "lucide-react";
import GradientIcon from "@/components/ui/gradient-icon";
import MiniLeafletMap from "./MiniLeafletMap";

function timeSince(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `Há ${s}s`;
  if (s < 3600) return `Há ${Math.floor(s / 60)} min`;
  return `Há ${Math.floor(s / 3600)}h`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
  const { usuario } = useAuth();
  const firstName = (usuario?.nome_completo || "").split(" ")[0];
  const avatarUrl = usuario?.avatar_url || null;
  const [showMap, setShowMap] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const counterStartRef = useRef<number | null>(null);
  const prevActiveRef = useRef(false);

  const isActive = !!(device?.is_recording || device?.is_monitoring);

  // When activity starts via Realtime, mark local start time; when it stops, reset
  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      // Just became active — start counter from now
      counterStartRef.current = Date.now();
    } else if (!isActive && prevActiveRef.current) {
      // Just became inactive — reset
      counterStartRef.current = null;
      setElapsed(0);
    }
    prevActiveRef.current = isActive;
  }, [isActive]);

  // Tick every second while active
  useEffect(() => {
    if (!isActive) {
      setElapsed(0);
      return;
    }
    if (!counterStartRef.current) {
      counterStartRef.current = Date.now();
    }
    const tick = () => {
      if (counterStartRef.current) {
        setElapsed(Math.max(0, Math.floor((Date.now() - counterStartRef.current) / 1000)));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isActive]);

  if (loading) {
    return (
      <div className="ampara-card p-5">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const online = device ? isOnline(device.last_ping_at) : false;
  const noDevice = error || !device;
  const panicActive = device?.panicActive ?? false;

  return (
    <>
      <div className={`ampara-card p-5 relative overflow-hidden transition-all duration-500 ${
        panicActive ? "animate-[panic-pulse_2s_ease-in-out_infinite] ring-2 ring-destructive/50" : ""
      }`}>
        {/* Panic banner */}
        {panicActive && (
          <div className="absolute top-0 left-0 right-0 flex items-center justify-center gap-1.5 bg-destructive text-destructive-foreground text-[11px] font-bold py-1 tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5" />
            PÂNICO ATIVO
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        )}
        {/* Recording / Monitoring indicator */}
        {(device?.is_recording || device?.is_monitoring) && (
          <div className={`absolute left-0 right-0 flex items-center justify-center gap-1 text-[10px] font-medium py-0.5 ${
            panicActive ? "top-[24px]" : "top-0"
          } ${
            device.is_recording
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          }`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${
                device.is_recording ? "bg-destructive" : "bg-emerald-400"
              }`} />
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                device.is_recording ? "bg-destructive" : "bg-emerald-500"
              }`} />
            </span>
            <Mic className="w-2.5 h-2.5" />
            {device.is_recording ? `Gravando ${formatElapsed(elapsed)}` : "Monitorando"}
          </div>
        )}

        {/* Icon */}
        <div className={panicActive && (device?.is_recording || device?.is_monitoring) ? "mt-10" : panicActive ? "mt-4" : (device?.is_recording || device?.is_monitoring) ? "mt-4" : ""}>
        <GradientIcon icon={Smartphone} size="sm" />
        </div>

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
          {(() => {
            const recentGps = location?.created_at
              ? Date.now() - new Date(location.created_at).getTime() < 330_000
              : false;
            return (
              <button
                onClick={() => setShowMap(true)}
                className={`inline-flex items-center gap-1 text-[10px] font-medium transition-colors ${
                  panicActive
                    ? "text-destructive"
                    : recentGps
                      ? "text-blue-500"
                      : "text-primary hover:text-primary/80"
                }`}
                title="Ver localização"
              >
                <MapPin className={`w-3.5 h-3.5 ${
                  panicActive
                    ? "animate-pulse"
                    : recentGps
                      ? "animate-pulse"
                      : ""
                }`} />
                GPS
              </button>
            );
          })()}
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
                  <MiniLeafletMap
                    latitude={location.latitude}
                    longitude={location.longitude}
                    avatarUrl={avatarUrl}
                    firstName={firstName}
                    panicActive={panicActive}
                    locationTimestamp={location.created_at}
                  />

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
