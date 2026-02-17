import { useEffect, useRef, useState, useCallback } from "react";
import { useMapDeviceData } from "@/hooks/useMapDeviceData";
import { useMovementStatus } from "@/hooks/useMovementStatus";
import { useMapbox } from "@/hooks/useMapbox";
import { Loader2, MapPin, Locate, Signal, Box, Map } from "lucide-react";
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

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

/** Generate a GeoJSON circle polygon */
function createCircleGeoJSON(center: [number, number], radiusMeters: number, steps = 64) {
  const coords: [number, number][] = [];
  const km = radiusMeters / 1000;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = km * Math.cos(angle);
    const dy = km * Math.sin(angle);
    const lat = center[1] + (dy / 111.32);
    const lng = center[0] + (dx / (111.32 * Math.cos(center[1] * (Math.PI / 180))));
    coords.push([lng, lat]);
  }
  return { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [coords] }, properties: {} };
}

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
  const [following, setFollowing] = useState(true);
  const [is3D, setIs3D] = useState(true);
  const mapLoadedRef = useRef(false);

  // Refresh every 3s for GPS feel
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3_000);
    return () => clearInterval(id);
  }, []);

  // Init map
  useEffect(() => {
    injectStyles();
    if (!mapContainerRef.current || mapRef.current || !mapboxgl) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [-47.93, -15.78],
      zoom: 4,
      attributionControl: false,
      pitch: 45,
      bearing: -10,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");

    map.on("load", () => {
      mapLoadedRef.current = true;

      // Add 3D building extrusions
      const layers = map.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === "symbol" && (layer.layout as any)?.["text-field"]
      )?.id;

      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#ddd",
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.5, ["get", "height"]],
            "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 14.5, ["get", "min_height"]],
            "fill-extrusion-opacity": 0.7,
          },
        },
        labelLayerId
      );
    });

    map.on("dragstart", () => setFollowing(false));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
    };
  }, [mapboxgl]);

  // Update marker with smooth animation
  useEffect(() => {
    if (!mapRef.current || !data || !mapboxgl) return;

    const recentLocation = Date.now() - new Date(data.created_at).getTime() < 60_000;

    const imgHtml = data.avatarUrl
      ? `<img src="${data.avatarUrl}" class="ampara-nav-img" alt="${data.firstName}" />`
      : `<div class="ampara-nav-placeholder">${data.firstName.charAt(0).toUpperCase()}</div>`;
    const dotClass = data.panicActive ? "ampara-nav-dot ampara-nav-dot-panic" : recentLocation ? "ampara-nav-dot ampara-nav-dot-active" : "ampara-nav-dot";

    const el = document.createElement("div");
    el.className = "ampara-nav-marker";
    el.innerHTML = `
      <div class="${dotClass}">${imgHtml}</div>
      <div class="ampara-nav-arrow"></div>
    `;

    const position: [number, number] = [data.longitude, data.latitude];

    if (markerRef.current) {
      const from = prevPosRef.current || position;
      smoothPanMarker(markerRef.current, from, position, 800);
      // Update visual
      const markerEl = markerRef.current.getElement();
      markerEl.className = "ampara-nav-marker";
      markerEl.innerHTML = `
        <div class="${dotClass}">${imgHtml}</div>
        <div class="ampara-nav-arrow"></div>
      `;
    } else {
      markerRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(position)
        .addTo(mapRef.current);
      mapRef.current.flyTo({ center: position, zoom: 15, pitch: 45, bearing: -10, duration: 1500 });
    }

    // Accuracy circle
    const accuracy = data.precisao_metros ?? 20;
    const circleData = createCircleGeoJSON(position, accuracy);
    const fillColor = data.panicActive ? "#ef4444" : "#3b82f6";

    if (mapLoadedRef.current || mapRef.current.isStyleLoaded()) {
      if (mapRef.current.getSource("accuracy")) {
        (mapRef.current.getSource("accuracy") as any).setData(circleData);
        mapRef.current.setPaintProperty("accuracy-fill", "fill-color", fillColor);
        mapRef.current.setPaintProperty("accuracy-outline", "line-color", fillColor);
      } else {
        mapRef.current.addSource("accuracy", { type: "geojson", data: circleData as any });
        mapRef.current.addLayer({
          id: "accuracy-fill",
          type: "fill",
          source: "accuracy",
          paint: { "fill-color": fillColor, "fill-opacity": 0.08 },
        });
        mapRef.current.addLayer({
          id: "accuracy-outline",
          type: "line",
          source: "accuracy",
          paint: { "line-color": fillColor, "line-opacity": 0.25, "line-width": 1.5 },
        });
      }
    }

    if (following) {
      mapRef.current.panTo(position);
    }

    prevPosRef.current = position;
  }, [data, mapboxgl, tick, following]);

  const recenter = useCallback(() => {
    if (!mapRef.current || !data) return;
    setFollowing(true);
    mapRef.current.panTo([data.longitude, data.latitude]);
    mapRef.current.setZoom(17);
  }, [data]);

  const toggle3D = useCallback(() => {
    if (!mapRef.current) return;
    if (is3D) {
      mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 500 });
      setIs3D(false);
    } else {
      mapRef.current.easeTo({ pitch: 45, bearing: -10, duration: 500 });
      setIs3D(true);
    }
  }, [is3D]);

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

        {/* 2D/3D toggle button */}
        <button
          onClick={toggle3D}
          className="absolute right-3 bottom-44 z-10 w-10 h-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 shadow-xl flex items-center justify-center text-white hover:bg-black/90 transition-all active:scale-95"
          title={is3D ? "Visão 2D" : "Visão 3D"}
        >
          {is3D ? <Map className="w-4 h-4" /> : <Box className="w-4 h-4" />}
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
