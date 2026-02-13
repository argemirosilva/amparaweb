import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapDeviceData } from "@/hooks/useMapDeviceData";
import { useMovementStatus } from "@/hooks/useMovementStatus";
import { Loader2, MapPin } from "lucide-react";

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h${mins % 60 > 0 ? `${mins % 60}min` : ""}`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function buildMarkerHtml(
  avatarUrl: string | null,
  firstName: string,
  movementLabel: string,
  movementEmoji: string,
  panicActive: boolean,
  recentLocation: boolean,
  address: string,
  stationarySince: string | null,
  lastUpdate: string,
): string {
  const imgSrc = avatarUrl || "";
  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" class="ampara-marker-img" alt="${firstName}" />`
    : `<div class="ampara-marker-img ampara-marker-placeholder">${firstName.charAt(0).toUpperCase()}</div>`;

  const pulseClass = panicActive
    ? "ampara-marker-panic"
    : recentLocation
      ? "ampara-marker-active"
      : "";
  const panicBadge = panicActive
    ? `<div class="ampara-panic-badge">!</div>`
    : "";

  const stationaryText = stationarySince
    ? `📍 Neste local há ${formatRelativeTime(stationarySince)}`
    : "";
  const updateText = `🕐 Atualizado há ${formatRelativeTime(lastUpdate)}`;

  return `
    <div class="ampara-marker ${pulseClass}">
      <div class="ampara-marker-ring-wrapper">
        <div class="ampara-marker-ring">${imgHtml}</div>
        ${panicBadge}
      </div>
      <div class="ampara-marker-info">
        <span class="ampara-marker-name">${firstName}</span>
        <span class="ampara-marker-status">${movementEmoji} ${movementLabel}</span>
        <span class="ampara-marker-address">${address}</span>
        ${stationaryText ? `<span class="ampara-marker-time">${stationaryText}</span>` : ""}
        <span class="ampara-marker-time">${updateText}</span>
      </div>
    </div>
  `;
}

// Inject CSS once
const STYLE_ID = "ampara-marker-styles";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .ampara-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
    }
    .ampara-marker-ring-wrapper {
      position: relative;
      display: inline-flex;
    }
    .ampara-marker-ring {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      padding: 3px;
      background: linear-gradient(135deg, hsl(280 70% 50%), hsl(320 80% 55%));
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }
    .ampara-marker-active .ampara-marker-ring {
      animation: ampara-pulse-blue 2s ease-in-out infinite;
    }
    @keyframes ampara-pulse-blue {
      0%, 100% { box-shadow: 0 0 0 0 hsla(220, 80%, 55%, 0.5); }
      50% { box-shadow: 0 0 0 10px hsla(220, 80%, 55%, 0); }
    }
    .ampara-panic-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: hsl(0 80% 50%);
      color: white;
      font-size: 13px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      animation: ampara-badge-pulse 1s ease-in-out infinite;
      z-index: 10;
    }
    @keyframes ampara-badge-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }
    .ampara-marker-panic .ampara-marker-ring {
      background: hsl(0 80% 50%);
      animation: ampara-pulse 1.2s ease-in-out infinite;
    }
    @keyframes ampara-pulse {
      0%, 100% { box-shadow: 0 0 0 0 hsla(0, 80%, 50%, 0.6); }
      50% { box-shadow: 0 0 0 14px hsla(0, 80%, 50%, 0); }
    }
    .ampara-marker-img {
      width: 44px;
      height: 44px;
      min-width: 44px;
      min-height: 44px;
      border-radius: 50%;
      object-fit: cover;
      aspect-ratio: 1;
    }
    .ampara-marker-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: hsl(240 5% 26%);
      color: white;
      font-weight: 700;
      font-size: 18px;
    }
    .ampara-marker-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: hsl(0 0% 10% / 0.85);
      backdrop-filter: blur(4px);
      border-radius: 8px;
      padding: 3px 8px;
      max-width: 200px;
    }
    .ampara-marker-name {
      color: white;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
    }
    .ampara-marker-status {
      color: hsl(0 0% 80%);
      font-size: 10px;
      line-height: 1.2;
    }
    .ampara-marker-address {
      color: hsl(0 0% 65%);
      font-size: 9px;
      line-height: 1.3;
      text-align: center;
      max-width: 190px;
      word-wrap: break-word;
      white-space: normal;
    }
    .ampara-marker-time {
      color: hsl(0 0% 55%);
      font-size: 9px;
      line-height: 1.2;
      text-align: center;
    }
    /* Hide Leaflet attribution & logo */
    .leaflet-control-attribution,
    .leaflet-control-attribution a {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

export default function Mapa() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const { data, loading, error } = useMapDeviceData();
  const { update: updateMovement } = useMovementStatus();

  // Init map
  useEffect(() => {
    injectStyles();
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      attributionControl: false,
      zoomControl: true,
    }).setView([-15.78, -47.93], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update marker
  useEffect(() => {
    if (!mapRef.current || !data) return;

    const movement = updateMovement(data.speed, data.precisao_metros);

    const movementLabel = data.isHome ? "Em Casa" : movement.label;
    const movementEmoji = data.isHome ? "🏠" : movement.emoji;

    const address = data.isHome
      ? "🏠 Em Casa"
      : data.geo?.display_address || "Localizando...";

    const recentLocation = Date.now() - new Date(data.created_at).getTime() < 60_000;

    const html = buildMarkerHtml(
      data.avatarUrl,
      data.firstName,
      movementLabel,
      movementEmoji,
      data.panicActive,
      recentLocation,
      address,
      data.stationarySince,
      data.created_at,
    );

    const icon = L.divIcon({
      html,
      className: "",
      iconSize: [200, 160],
      iconAnchor: [100, 80],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([data.latitude, data.longitude]);
      markerRef.current.setIcon(icon);
    } else {
      markerRef.current = L.marker([data.latitude, data.longitude], { icon }).addTo(mapRef.current);
      mapRef.current.setView([data.latitude, data.longitude], 16);
    }
  }, [data]);

  return (
    <div className="relative w-full flex-1 flex items-center justify-center">
      <div className="relative w-full h-full rounded-2xl overflow-hidden border border-border">
        <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {error && !data && !loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
          <MapPin className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}
      </div>
    </div>
  );
}
