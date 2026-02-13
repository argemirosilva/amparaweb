/// <reference types="google.maps" />
import { useEffect, useRef, useState, useCallback } from "react";
import { useMapDeviceData } from "@/hooks/useMapDeviceData";
import { useMovementStatus } from "@/hooks/useMovementStatus";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { Loader2, MapPin, Locate, Signal } from "lucide-react";

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

const MARKER_STYLE_ID = "ampara-gmap-nav-styles";
function injectStyles() {
  if (document.getElementById(MARKER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = MARKER_STYLE_ID;
  style.textContent = `
    .ampara-nav-marker { display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4)); transition: transform 0.3s ease; }
    .ampara-nav-dot { width:48px; height:48px; border-radius:50%; border:3px solid white; overflow:hidden; box-shadow:0 0 0 3px hsla(280,70%,50%,0.5); transition: box-shadow 0.3s ease; }
    .ampara-nav-dot-active { box-shadow:0 0 0 3px hsla(220,80%,55%,0.6), 0 0 20px 4px hsla(220,80%,55%,0.3); }
    .ampara-nav-dot-panic { box-shadow:0 0 0 3px hsla(0,80%,50%,0.6), 0 0 20px 4px hsla(0,80%,50%,0.3); animation:ampara-nav-pulse 1.2s ease-in-out infinite; }
    @keyframes ampara-nav-pulse { 0%,100%{box-shadow:0 0 0 3px hsla(0,80%,50%,0.6), 0 0 20px 4px hsla(0,80%,50%,0.3);} 50%{box-shadow:0 0 0 6px hsla(0,80%,50%,0.4), 0 0 30px 8px hsla(0,80%,50%,0.2);} }
    .ampara-nav-img { width:100%; height:100%; object-fit:cover; }
    .ampara-nav-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:hsl(240 5% 26%); color:white; font-weight:700; font-size:20px; }
    .ampara-nav-arrow { width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-top:10px solid white; margin-top:-2px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
  `;
  document.head.appendChild(style);
}

/** Smoothly animate AdvancedMarkerElement position */
function smoothPanMarker(
  marker: google.maps.marker.AdvancedMarkerElement,
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
  duration = 800,
) {
  const start = performance.now();
  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    marker.position = {
      lat: from.lat + (to.lat - from.lat) * ease,
      lng: from.lng + (to.lng - from.lng) * ease,
    };
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export default function Mapa() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const accuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const prevPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const { data, loading, error } = useMapDeviceData();
  const { update: updateMovement } = useMovementStatus();
  const { maps, loading: mapsLoading, error: mapsError } = useGoogleMaps();
  const [tick, setTick] = useState(0);
  const [following, setFollowing] = useState(true);

  // Refresh every 3s for GPS feel
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3_000);
    return () => clearInterval(id);
  }, []);

  // Init map
  useEffect(() => {
    injectStyles();
    if (!mapContainerRef.current || mapRef.current || !maps) return;

    mapRef.current = new maps.Map(mapContainerRef.current, {
      center: { lat: -15.78, lng: -47.93 },
      zoom: 4,
      mapId: "ampara-main-map",
      disableDefaultUI: true,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
    });

    return () => {
      mapRef.current = null;
    };
  }, [maps]);

  // Stop following on drag
  useEffect(() => {
    if (!mapRef.current || !maps) return;
    const listener = mapRef.current.addListener("dragstart", () => setFollowing(false));
    return () => google.maps.event.removeListener(listener);
  }, [maps, mapRef.current]);

  // Update marker with smooth animation
  useEffect(() => {
    if (!mapRef.current || !data || !maps) return;

    const recentLocation = Date.now() - new Date(data.created_at).getTime() < 60_000;

    const imgHtml = data.avatarUrl
      ? `<img src="${data.avatarUrl}" class="ampara-nav-img" alt="${data.firstName}" />`
      : `<div class="ampara-nav-placeholder">${data.firstName.charAt(0).toUpperCase()}</div>`;
    const dotClass = data.panicActive ? "ampara-nav-dot ampara-nav-dot-panic" : recentLocation ? "ampara-nav-dot ampara-nav-dot-active" : "ampara-nav-dot";

    const content = document.createElement("div");
    content.innerHTML = `
      <div class="ampara-nav-marker">
        <div class="${dotClass}">${imgHtml}</div>
        <div class="ampara-nav-arrow"></div>
      </div>
    `;

    const position = { lat: data.latitude, lng: data.longitude };

    if (markerRef.current) {
      const from = prevPosRef.current || position;
      smoothPanMarker(markerRef.current, from, position, 800);
      markerRef.current.content = content;
    } else {
      markerRef.current = new maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        content,
      });
      mapRef.current.setZoom(17);
    }

    // Accuracy circle
    const accuracy = data.precisao_metros ?? 20;
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setCenter(position);
      accuracyCircleRef.current.setRadius(accuracy);
    } else {
      accuracyCircleRef.current = new maps.Circle({
        map: mapRef.current,
        center: position,
        radius: accuracy,
        fillColor: data.panicActive ? "#ef4444" : "#3b82f6",
        fillOpacity: 0.08,
        strokeColor: data.panicActive ? "#ef4444" : "#3b82f6",
        strokeOpacity: 0.25,
        strokeWeight: 1.5,
        clickable: false,
      });
    }

    if (following) {
      mapRef.current.panTo(position);
    }

    prevPosRef.current = position;
  }, [data, maps, tick, following]);

  const recenter = useCallback(() => {
    if (!mapRef.current || !data) return;
    setFollowing(true);
    mapRef.current.panTo({ lat: data.latitude, lng: data.longitude });
    mapRef.current.setZoom(17);
  }, [data]);

  const isLoading = loading || mapsLoading;
  const displayError = error || mapsError;

  // Computed HUD values
  const movement = data ? updateMovement(data.speed, data.precisao_metros) : null;
  const speedKmh = movement ? Math.round(movement.speedKmh) : 0;
  const movementLabel = data?.isHome ? "Em Casa" : movement?.label || "—";
  const movementEmoji = data?.isHome ? "🏠" : movement?.emoji || "";
  const address = data?.isHome ? "🏠 Em Casa" : data?.geo?.display_address || "Localizando...";
  const isRecent = data ? Date.now() - new Date(data.created_at).getTime() < 60_000 : false;

  return (
    <div className="relative w-full flex-1 flex flex-col">
      <div className="relative w-full flex-1 rounded-2xl overflow-hidden border border-border">
        <div ref={mapContainerRef} className="absolute inset-0 z-0" />

        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {displayError && !data && !isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
            <MapPin className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{displayError}</p>
          </div>
        )}

        {/* Re-center button */}
        {!following && data && (
          <button
            onClick={recenter}
            className="absolute right-3 bottom-32 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-xl flex items-center justify-center text-white hover:bg-black/90 transition-all active:scale-95"
            title="Centralizar"
          >
            <Locate className="w-4 h-4" />
          </button>
        )}

        {/* Bottom HUD overlay */}
        {data && !isLoading && (
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <div className={`rounded-2xl backdrop-blur-xl shadow-2xl border overflow-hidden ${data.panicActive ? "bg-red-950/90 border-red-800/40" : "bg-black/80 border-white/10"}`}>
              <div className="flex items-stretch">
                {/* Speed */}
                <div className={`flex flex-col items-center justify-center px-4 py-2.5 border-r ${data.panicActive ? "border-red-800/30" : "border-white/10"}`}>
                  <span className="text-2xl font-mono font-black text-white leading-none">
                    {speedKmh}
                  </span>
                  <span className="text-[8px] text-zinc-500 font-medium tracking-wider uppercase mt-0.5">km/h</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-center gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isRecent ? "bg-green-400 animate-pulse" : "bg-zinc-500"}`} />
                    <span className="text-xs font-semibold text-white">
                      {movementEmoji} {movementLabel}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-snug break-words">{address}</p>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {data.precisao_metros != null && (
                      <span className="flex items-center gap-0.5 text-[9px] text-zinc-500">
                        <Signal className="w-2.5 h-2.5" />
                        ±{Math.round(data.precisao_metros)}m
                      </span>
                    )}
                    {data.stationarySince && (
                      <span className="text-[9px] text-zinc-500">
                        📍 {formatRelativeTime(data.stationarySince)}
                      </span>
                    )}
                    <span className="text-[9px] text-zinc-500">
                      🕐 {formatRelativeTime(data.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
