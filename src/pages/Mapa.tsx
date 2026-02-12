import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapDeviceData } from "@/hooks/useMapDeviceData";
import { Loader2, MapPin } from "lucide-react";

function getMovementLabel(speed: number | null, isHome: boolean): { label: string; emoji: string } {
  if (isHome) return { label: "Em Casa", emoji: "🏠" };
  if (speed === null || speed === 0) return { label: "Parada", emoji: "📍" };
  if (speed >= 1 && speed <= 15) return { label: "Caminhando", emoji: "🚶‍♀️" };
  return { label: "Em Veículo", emoji: "🚗" };
}

function buildMarkerHtml(
  avatarUrl: string | null,
  firstName: string,
  speed: number | null,
  panicActive: boolean,
  isHome: boolean,
  address: string,
): string {
  const { label, emoji } = getMovementLabel(speed, isHome);
  const imgSrc = avatarUrl || "";
  const imgHtml = imgSrc
    ? `<img src="${imgSrc}" class="ampara-marker-img" alt="${firstName}" />`
    : `<div class="ampara-marker-img ampara-marker-placeholder">${firstName.charAt(0).toUpperCase()}</div>`;

  const pulseClass = panicActive ? "ampara-marker-panic" : "";

  return `
    <div class="ampara-marker ${pulseClass}">
      <div class="ampara-marker-ring">${imgHtml}</div>
      <div class="ampara-marker-info">
        <span class="ampara-marker-name">${firstName}</span>
        <span class="ampara-marker-status">${emoji} ${label}</span>
        <span class="ampara-marker-address">${address}</span>
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
    .ampara-marker-ring {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      padding: 3px;
      background: linear-gradient(135deg, hsl(280 70% 50%), hsl(320 80% 55%));
      display: flex;
      align-items: center;
      justify-content: center;
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
      border-radius: 50%;
      object-fit: cover;
      background: hsl(240 5% 26%);
    }
    .ampara-marker-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
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
      max-width: 180px;
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
      line-height: 1.2;
      text-align: center;
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    const address = data.isHome
      ? "🏠 Em Casa"
      : data.geo?.display_address || "Localizando...";

    const html = buildMarkerHtml(
      data.avatarUrl,
      data.firstName,
      data.speed,
      data.panicActive,
      data.isHome,
      address,
    );

    const icon = L.divIcon({
      html,
      className: "",
      iconSize: [80, 90],
      iconAnchor: [40, 45],
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
    <div className="relative w-full h-[calc(100dvh-3.5rem-3.5rem)] md:h-[calc(100dvh-3.5rem)]">
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
  );
}
