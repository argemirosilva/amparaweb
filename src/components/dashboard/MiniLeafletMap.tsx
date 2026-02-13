/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

interface MiniGoogleMapProps {
  latitude: number;
  longitude: number;
  avatarUrl?: string | null;
  firstName?: string;
  panicActive?: boolean;
  locationTimestamp?: string | null;
}

const STYLE_ID = "mini-gmap-marker-styles";
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

export default function MiniLeafletMap({ latitude, longitude, avatarUrl, firstName = "", panicActive = false, locationTimestamp }: MiniGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const { maps } = useGoogleMaps();

  useEffect(() => {
    injectStyles();
    if (!containerRef.current || !maps) return;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(containerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 16,
        mapId: "ampara-mini-map",
        disableDefaultUI: true,
        gestureHandling: "none",
        keyboardShortcuts: false,
      });
    }

    const imgHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="mini-marker-img" alt="${firstName}" />`
      : `<div class="mini-marker-placeholder">${firstName.charAt(0).toUpperCase()}</div>`;

    const recentLocation = locationTimestamp
      ? Date.now() - new Date(locationTimestamp).getTime() < 60_000
      : false;

    const pulseClass = panicActive ? "mini-marker-panic" : recentLocation ? "mini-marker-active" : "";

    const content = document.createElement("div");
    content.innerHTML = `
      <div class="mini-marker ${pulseClass}">
        <div class="mini-marker-ring">${imgHtml}</div>
        <div class="mini-marker-label">${firstName}</div>
      </div>
    `;

    const position = { lat: latitude, lng: longitude };

    if (markerRef.current) {
      markerRef.current.position = position;
      markerRef.current.content = content;
    } else {
      markerRef.current = new maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        content,
      });
    }

    mapRef.current.setCenter(position);

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
      mapRef.current = null;
    };
  }, [latitude, longitude, avatarUrl, firstName, panicActive, maps, locationTimestamp]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[200px] rounded-xl overflow-hidden border border-border"
    />
  );
}
