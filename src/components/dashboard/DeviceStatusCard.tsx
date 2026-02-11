import { useDeviceStatus } from "@/hooks/useDeviceStatus";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Smartphone,
  Battery,
  BatteryCharging,
  MapPin,
  ExternalLink,
  Wifi,
  WifiOff,
} from "lucide-react";

function timeSince(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s atrás`;
  if (s < 3600) return `${Math.floor(s / 60)}min atrás`;
  return `${Math.floor(s / 3600)}h atrás`;
}

function isOnline(lastPing: string | null): boolean {
  if (!lastPing) return false;
  return Date.now() - new Date(lastPing).getTime() < 45_000;
}

export default function DeviceStatusCard() {
  const { device, location, address, addressLoading, loading, error, lastFetch } = useDeviceStatus();

  if (loading) {
    return (
      <div className="ampara-card space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ampara-card">
        <h3 className="font-display font-semibold text-foreground mb-2">Monitoramento do Dispositivo</h3>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="ampara-card">
        <h3 className="font-display font-semibold text-foreground mb-2">Monitoramento do Dispositivo</h3>
        <p className="text-sm text-muted-foreground">Nenhum dado recebido do dispositivo.</p>
      </div>
    );
  }

  const online = isOnline(device.last_ping_at);
  const lowBattery = device.bateria_percentual !== null && device.bateria_percentual < 20;

  return (
    <div className="ampara-card space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground">Monitoramento do Dispositivo</h3>
        {lastFetch && (
          <span className="text-xs text-muted-foreground">Atualizado {timeSince(lastFetch)}</span>
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {online ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
            <Wifi className="w-3 h-3 mr-1" /> Online
          </Badge>
        ) : (
          <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
            <WifiOff className="w-3 h-3 mr-1" /> Offline
          </Badge>
        )}

        {device.is_recording && (
          <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 animate-pulse">
            Gravando
          </Badge>
        )}
        {device.is_monitoring && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
            Monitorando
          </Badge>
        )}
        {!device.is_recording && !device.is_monitoring && (
          <Badge variant="secondary">Inativo</Badge>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-muted-foreground text-xs">Dispositivo</p>
            <p className="text-foreground">{device.dispositivo_info || "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {device.is_charging ? (
            <BatteryCharging className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <Battery className={`w-4 h-4 shrink-0 ${lowBattery ? "text-orange-500" : "text-muted-foreground"}`} />
          )}
          <div>
            <p className="text-muted-foreground text-xs">Bateria</p>
            <p className={lowBattery ? "text-orange-500 font-medium" : "text-foreground"}>
              {device.bateria_percentual !== null ? `${device.bateria_percentual}%` : "—"}
              {device.is_charging && " ⚡"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <div className="w-4 h-4 shrink-0" />
          <div>
            <p className="text-muted-foreground text-xs">Último ping</p>
            <p className="text-foreground">
              {device.last_ping_at
                ? new Date(device.last_ping_at).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Location */}
      {location && (
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            Última Localização
          </div>
          <div className="text-sm text-muted-foreground space-y-1 pl-6">
            <p>Lat: {location.latitude.toFixed(6)} — Lng: {location.longitude.toFixed(6)}</p>
            {location.precisao_metros !== null && <p>Precisão: ~{Math.round(location.precisao_metros)}m</p>}
            <p>
              {addressLoading
                ? "Buscando endereço..."
                : address || "Endereço não disponível"}
            </p>
          </div>
          <a
            href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline pl-6"
          >
            Abrir no Google Maps <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}
