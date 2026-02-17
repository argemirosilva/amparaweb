import { useEffect, useRef } from "react";
import { useMapbox } from "@/hooks/useMapbox";

interface MiniMapProps {
  latitude: number;
  longitude: number;
  avatarUrl?: string | null;
  firstName?: string;
  panicActive?: boolean;
  locationTimestamp?: string | null;
}

const STYLE_ID = "mini-mbx-marker-styles";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .mini-marker { display:flex; flex-direction:column; align-items:center; gap:2px; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3)); }
    .mini-marker-ring { width:44px; height:44px; border-radius:50%; padding:2px; background:linear-gradient(135deg,hsl(280 70% 50%),hsl(320 80% 55%)); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
    .mini-marker-active .mini-marker-ring { animation:mini-pulse-blue 2s ease-in-out infinite; }
    @keyframes mini-pulse-blue { 0%,100%{box-shadow:0 0 0 0 hsla(220,80%,55%,0.5);} 50%{box-shadow:0 0 0 8px hsla(220,80%,55%,0);} }
    .mini-marker-panic .mini-marker-ring { background:hsl(0 80% 50%); animation:mini-pulse 1.2s ease-in-out infinite; }
    @keyframes mini-pulse { 0%,100%{box-shadow:0 0 0 0 hsla(0,80%,50%,0.6);} 50%{box-shadow:0 0 0 10px hsla(0,80%,50%,0);} }
    .mini-marker-img { width:38px; height:38px; min-width:38px; min-height:38px; border-radius:50%; object-fit:cover; }
    .mini-marker-placeholder { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:hsl(240 5% 26%); color:white; font-weight:700; font-size:16px; }
    .mini-marker-label { background:hsl(0 0% 10%/0.85); backdrop-filter:blur(4px); border-radius:6px; padding:1px 6px; color:white; font-size:10px; font-weight:600; white-space:nowrap; }
  `;
  document.head.appendChild(style);
}

const DARK_STYLE = "mapbox://styles/mapbox/dark-v11";

export default function MiniLeafletMap({ latitude, longitude, avatarUrl, firstName = "", panicActive = false, locationTimestamp }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const { mapboxgl, loading } = useMapbox();

  useEffect(() => {
    injectStyles();
    if (!containerRef.current || !mapboxgl || loading) return;

    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style: DARK_STYLE,
        center: [longitude, latitude],
        zoom: 16,
        interactive: false,
        attributionControl: false,
      });
    }

    const imgHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="mini-marker-img" alt="${firstName}" />`
      : `<div class="mini-marker-placeholder">${firstName.charAt(0).toUpperCase()}</div>`;

    const recentLocation = locationTimestamp
      ? Date.now() - new Date(locationTimestamp).getTime() < 60_000
      : false;

    const pulseClass = panicActive ? "mini-marker-panic" : recentLocation ? "mini-marker-active" : "";

    const el = document.createElement("div");
    el.innerHTML = `
      <div class="mini-marker ${pulseClass}">
        <div class="mini-marker-ring">${imgHtml}</div>
        <div class="mini-marker-label">${firstName}</div>
      </div>
    `;

    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude]);
      // Replace element content
      const markerEl = markerRef.current.getElement();
      markerEl.innerHTML = "";
      markerEl.appendChild(el.firstElementChild!);
    } else {
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current);
    }

    mapRef.current.setCenter([longitude, latitude]);

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude, avatarUrl, firstName, panicActive, mapboxgl, loading, locationTimestamp]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[200px] rounded-xl overflow-hidden border border-border"
    />
  );
}
