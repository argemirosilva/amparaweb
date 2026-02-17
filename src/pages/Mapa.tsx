import { useEffect, useRef, useState, useCallback } from "react";
import { useMapDeviceData } from "@/hooks/useMapDeviceData";
import { useMovementStatus } from "@/hooks/useMovementStatus";
import { useMapbox } from "@/hooks/useMapbox";
import { Loader2, MapPin, Locate, Signal, Satellite, Navigation } from "lucide-react";
import type mapboxgl from "mapbox-gl";

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

const MARKER_STYLE_ID = "ampara-mbx-nav-styles";
function injectStyles() {
  if (document.getElementById(MARKER_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = MARKER_STYLE_ID;
  style.textContent = `
    .ampara-nav-marker { display:flex; flex-direction:column; align-items:center; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4)); transition: transform 0.3s ease; }
    .ampara-nav-dot { width:48px; height:48px; border-radius:50%; border:3px solid white; overflow:hidden; box-shadow:0 0 0 3px hsla(280,70%,50%,0.5), 0 4px 12px rgba(0,0,0,0.3); transition: box-shadow 0.3s ease; }
    .ampara-nav-dot-active { box-shadow:0 0 0 3px hsla(220,80%,55%,0.6), 0 0 20px 4px hsla(220,80%,55%,0.3); }
    .ampara-nav-dot-panic { box-shadow:0 0 0 3px hsla(0,80%,50%,0.6), 0 0 20px 4px hsla(0,80%,50%,0.3); animation:ampara-nav-pulse 1.2s ease-in-out infinite; }
    @keyframes ampara-nav-pulse { 0%,100%{box-shadow:0 0 0 3px hsla(0,80%,50%,0.6), 0 0 20px 4px hsla(0,80%,50%,0.3);} 50%{box-shadow:0 0 0 6px hsla(0,80%,50%,0.4), 0 0 30px 8px hsla(0,80%,50%,0.2);} }
    .ampara-nav-img { width:100%; height:100%; object-fit:cover; }
    .ampara-nav-placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:hsl(240 5% 26%); color:white; font-weight:700; font-size:20px; }
    .ampara-nav-arrow { width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-top:10px solid white; margin-top:-2px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
  `;
  document.head.appendChild(style);
}

const STYLE_STREETS = "mapbox://styles/mapbox/streets-v12";
const STYLE_SATELLITE = "mapbox://styles/mapbox/satellite-streets-v12";


/** Smoothly animate marker position */
function smoothPanMarker(
  marker: mapboxgl.Marker,
  from: [number, number],
  to: [number, number],
  duration = 800,
) {
  const start = performance.now();
  function step(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    marker.setLngLat([
      from[0] + (to[0] - from[0]) * ease,
      from[1] + (to[1] - from[1]) * ease,
    ]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export default function Mapa() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const prevPosRef = useRef<[number, number] | null>(null);
  const { data, loading, error } = useMapDeviceData();
  const { update: updateMovement } = useMovementStatus();
  const { mapboxgl, loading: mapsLoading, error: mapsError } = useMapbox();
  const [tick, setTick] = useState(0);
  const [isSatellite, setIsSatellite] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);
  const mapLoadedRef = useRef(false);
  const [offScreenInfo, setOffScreenInfo] = useState<{ angle: number; cardinal: string } | null>(null);

  // Refresh relative timestamps every 15s (no need for 3s – data comes via realtime)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // Init map
  useEffect(() => {
    injectStyles();
    if (!mapContainerRef.current || mapRef.current || !mapboxgl) return;

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: STYLE_STREETS,
        center: [-47.93, -15.78],
        zoom: 16,
        attributionControl: false,
        pitch: 0,
        bearing: 0,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e) {
      console.error("[Mapa] WebGL init failed:", e);
      setWebglError("Seu navegador não suporta WebGL. Tente outro navegador ou dispositivo.");
      return;
    }

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");

    map.on("load", () => {
      mapLoadedRef.current = true;
    });

    

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
    };
  }, [mapboxgl]);

  // Build marker element once, update only classes when status changes
  const markerContentRef = useRef<{ avatarUrl: string | null; panicActive: boolean; recentLocation: boolean } | null>(null);

  // Update marker with smooth animation
  useEffect(() => {
    if (!mapRef.current || !data || !mapboxgl) return;

    const recentLocation = Date.now() - new Date(data.created_at).getTime() < 60_000;
    const position: [number, number] = [data.longitude, data.latitude];

    const needsVisualUpdate = !markerContentRef.current
      || markerContentRef.current.avatarUrl !== data.avatarUrl
      || markerContentRef.current.panicActive !== data.panicActive
      || markerContentRef.current.recentLocation !== recentLocation;

    if (markerRef.current) {
      // Smooth position animation
      const from = prevPosRef.current || position;
      smoothPanMarker(markerRef.current, from, position, 800);

      // Only rebuild DOM when visual state actually changes (not every tick)
      if (needsVisualUpdate) {
        const dotClass = data.panicActive ? "ampara-nav-dot ampara-nav-dot-panic" : recentLocation ? "ampara-nav-dot ampara-nav-dot-active" : "ampara-nav-dot";
        const dot = markerRef.current.getElement().querySelector(".ampara-nav-dot");
        if (dot) {
          dot.className = dotClass;
        }
        markerContentRef.current = { avatarUrl: data.avatarUrl, panicActive: data.panicActive, recentLocation };
      }
    } else {
      // First time: create marker with preloaded image
      const initial = data.firstName.charAt(0).toUpperCase();
      const dotClass = data.panicActive ? "ampara-nav-dot ampara-nav-dot-panic" : recentLocation ? "ampara-nav-dot ampara-nav-dot-active" : "ampara-nav-dot";

      const el = document.createElement("div");
      el.className = "ampara-nav-marker";

      const dot = document.createElement("div");
      dot.className = dotClass;

      if (data.avatarUrl) {
        const img = new Image();
        img.className = "ampara-nav-img";
        img.alt = data.firstName;
        img.crossOrigin = "anonymous";
        img.onerror = () => {
          img.remove();
          const placeholder = document.createElement("div");
          placeholder.className = "ampara-nav-placeholder";
          placeholder.textContent = initial;
          dot.appendChild(placeholder);
        };
        img.src = data.avatarUrl;
        dot.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "ampara-nav-placeholder";
        placeholder.textContent = initial;
        dot.appendChild(placeholder);
      }

      const arrow = document.createElement("div");
      arrow.className = "ampara-nav-arrow";

      el.appendChild(dot);
      el.appendChild(arrow);

      markerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(position)
        .addTo(mapRef.current);
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.flyTo({ center: position, zoom: Math.max(currentZoom, 16), duration: 1500 });
      markerContentRef.current = { avatarUrl: data.avatarUrl, panicActive: data.panicActive, recentLocation };
    }


    prevPosRef.current = position;
  }, [data, mapboxgl, tick]);

  // Track whether marker is off-screen and compute edge-clamped position
  useEffect(() => {
    if (!mapRef.current || !data) return;
    const map = mapRef.current;

    const checkVisibility = () => {
      const point = map.project([data.longitude, data.latitude]);
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const margin = 40;
      const pad = 28; // half button size

      if (point.x >= margin && point.x <= w - margin && point.y >= margin && point.y <= h - margin) {
        setOffScreenInfo(null);
      } else {
        const cx = w / 2;
        const cy = h / 2;
        const angle = Math.atan2(point.y - cy, point.x - cx);

        const bearing = map.getBearing();
        const geoBearing = (Math.atan2(point.x - cx, -(point.y - cy)) * 180 / Math.PI + bearing + 360) % 360;
        const cardinals = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];
        const cardinal = cardinals[Math.round(geoBearing / 45) % 8];
        setOffScreenInfo({ angle: angle * 180 / Math.PI, cardinal });
      }
    };

    checkVisibility();
    map.on("move", checkVisibility);
    return () => { map.off("move", checkVisibility); };
  }, [data]);

  const recenter = useCallback(() => {
    if (!mapRef.current || !data) return;
    mapRef.current.flyTo({ center: [data.longitude, data.latitude], zoom: 16, duration: 800 });
  }, [data]);

  const toggleSatellite = useCallback(() => {
    if (!mapRef.current) return;
    const newStyle = isSatellite ? STYLE_STREETS : STYLE_SATELLITE;
    mapRef.current.setStyle(newStyle);
    setIsSatellite(!isSatellite);

    mapRef.current.once("style.load", () => {
      mapLoadedRef.current = true;
    });
  }, [isSatellite]);

  const isLoading = loading || mapsLoading;
  const displayError = error || mapsError || webglError;

  // Computed HUD values
  const movement = data ? updateMovement(data.speed, data.precisao_metros) : null;
  const speedKmh = movement ? Math.round(movement.speedKmh) : 0;
  const movementLabel = data?.isHome ? "Em Casa" : movement?.label || "—";
  const movementEmoji = data?.isHome ? "🏠" : movement?.emoji || "";
  const address = data?.isHome ? "🏠 Em Casa" : data?.geo?.display_address || "Localizando...";
  const isRecent = data ? Date.now() - new Date(data.created_at).getTime() < 60_000 : false;

  return (
    <div className="relative w-full flex-1 flex flex-col min-h-0">
      <div className="relative w-full flex-1 rounded-2xl overflow-hidden border border-border" style={{ minHeight: "calc(100vh - 10rem)" }}>
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

        {/* Directional arrow when marker is off-screen */}
        {offScreenInfo && data && (
          <button
            onClick={recenter}
            className="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-label="Centralizar no marcador"
          >
            <div className="relative w-12 h-12 rounded-full bg-primary/90 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center border-2 border-white/30 animate-pulse">
              <span className="text-[10px] font-bold text-white leading-none">{offScreenInfo.cardinal}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" className="text-white" style={{ transform: `rotate(${offScreenInfo.angle + 90}deg)` }}>
                <path d="M8 2 L14 12 L8 9 L2 12 Z" fill="currentColor" />
              </svg>
            </div>
          </button>
        )}

        {/* Re-center button - always visible */}
        {data && (
          <button
            onClick={recenter}
            className="absolute right-3 bottom-32 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-xl flex items-center justify-center text-white hover:bg-black/90 transition-all active:scale-95"
            title="Centralizar"
          >
            <Locate className="w-4 h-4" />
          </button>
        )}

        {/* Satellite toggle button */}
        <button
          onClick={toggleSatellite}
          className="absolute right-3 bottom-44 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-xl flex items-center justify-center text-white hover:bg-black/90 transition-all active:scale-95"
          title={isSatellite ? "Mapa" : "Satélite"}
        >
          <Satellite className="w-4 h-4" />
        </button>

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
