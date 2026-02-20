import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveAddress } from "@/services/reverseGeocodeService";
import { classifyMovement } from "@/hooks/useMovementStatus";
import { useMapbox } from "@/hooks/useMapbox";
import { enhancePOILayers } from "@/hooks/useMapPOI";
import amparaIcon from "@/assets/ampara-icon-transparent.png";
import { Navigation, Locate, Signal } from "lucide-react";
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

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateSpeed(locs: LocationData[]): number | null {
  if (locs.length < 2) return null;
  const a = locs[0], b = locs[1];
  const dist = haversineDistance(a.latitude, a.longitude, b.latitude, b.longitude);
  const timeDiffSec = (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) / 1000;
  if (timeDiffSec <= 0) return null;
  return dist / timeDiffSec;
}

const STYLE_ID = "ampara-mbx-track-styles";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
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

interface ShareData {
  id: string;
  user_id: string;
  codigo: string;
  tipo: string;
  ativo: boolean;
  expira_em: string;
  alerta_id: string | null;
}

interface LocationData {
  latitude: number;
  longitude: number;
  precisao_metros: number | null;
  speed: number | null;
  heading: number | null;
  created_at: string;
}

interface UserInfo {
  nome_completo: string;
  avatar_url: string | null;
}

const STYLE_STREETS = "mapbox://styles/mapbox/streets-v12";


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

export default function Rastreamento() {
  const { codigo } = useParams<{ codigo: string }>();
  const [share, setShare] = useState<ShareData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [recentLocs, setRecentLocs] = useState<LocationData[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "active" | "expired" | "not_found">("loading");
  const [address, setAddress] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState("");
  const [stationarySince, setStationarySince] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [following, setFollowing] = useState(true);
  const [offScreenInfo, setOffScreenInfo] = useState<{ angle: number; cardinal: string } | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const prevPosRef = useRef<[number, number] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapLoadedRef = useRef(false);
  const markerContentRef = useRef<{ avatarUrl: string; panicActive: boolean; recentLocation: boolean } | null>(null);
  const { mapboxgl } = useMapbox();

  // Fetch share data
  useEffect(() => {
    if (!codigo) { setStatus("not_found"); return; }
    const fetchShare = async () => {
      const { data, error } = await supabase
        .from("compartilhamento_gps")
        .select("*")
        .eq("codigo", codigo)
        .maybeSingle();
      if (error || !data) { setStatus("not_found"); return; }
      if (!data.ativo || new Date(data.expira_em) < new Date()) { setStatus("expired"); return; }
      setShare(data as ShareData);
      setStatus("active");
      const { data: userData } = await supabase
        .from("usuarios")
        .select("nome_completo, avatar_url")
        .eq("id", data.user_id)
        .maybeSingle();
      if (userData) {
        setUserInfo(userData);
        // Preload avatar into browser cache before marker is created
        if (userData.avatar_url) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = userData.avatar_url;
        }
      }
    };
    fetchShare();
  }, [codigo]);

  // Fetch latest location & subscribe
  useEffect(() => {
    if (!share) return;
    const fetchLocation = async () => {
      const { data: locs } = await supabase
        .from("localizacoes")
        .select("latitude, longitude, precisao_metros, speed, heading, created_at")
        .eq("user_id", share.user_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (locs && locs.length > 0) {
        const latest = locs[0] as LocationData;
        setLocation(latest);
        setRecentLocs(locs.slice(0, 5) as LocationData[]);
        resolveAddress(latest.latitude, latest.longitude).then(geo => {
          setAddress(geo?.display_address || "Localizando...");
        });
        const THRESHOLD = 100;
        let since = latest.created_at;
        for (let i = 1; i < locs.length; i++) {
          const dist = haversineDistance(latest.latitude, latest.longitude, locs[i].latitude, locs[i].longitude);
          if (dist > THRESHOLD) break;
          since = locs[i].created_at;
        }
        setStationarySince(since !== latest.created_at ? since : null);
      }
    };
    fetchLocation();

    const channel = supabase
      .channel(`track-${share.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "localizacoes", filter: `user_id=eq.${share.user_id}` }, (payload) => {
        const d = payload.new as any;
        const loc: LocationData = { latitude: d.latitude, longitude: d.longitude, precisao_metros: d.precisao_metros, speed: d.speed, heading: d.heading, created_at: d.created_at };
        setLocation(loc);
        setRecentLocs(prev => {
          const updated = [loc, ...prev].slice(0, 5);
          let since = loc.created_at;
          for (let i = 1; i < updated.length; i++) {
            if (haversineDistance(loc.latitude, loc.longitude, updated[i].latitude, updated[i].longitude) <= 100) {
              since = updated[i].created_at;
            } else break;
          }
          setStationarySince(since !== loc.created_at ? since : null);
          return updated;
        });
        resolveAddress(loc.latitude, loc.longitude).then(geo => { setAddress(geo?.display_address || "Localizando..."); });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "compartilhamento_gps", filter: `id=eq.${share.id}` }, (payload) => {
        const updated = payload.new as any;
        if (!updated.ativo) {
          setStatus("expired");
        }
      });

    if (share.alerta_id) {
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "alertas_panico", filter: `id=eq.${share.alerta_id}` }, (payload) => {
        const updated = payload.new as any;
        if (updated.status !== "ativo") {
          setStatus("expired");
        }
      });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [share]);

  // Refresh relative times every 15s (GPS data arrives via realtime, no need for 3s)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!share) return;
    const tick = () => {
      const diff = new Date(share.expira_em).getTime() - Date.now();
      if (diff <= 0) { setStatus("expired"); setTimeLeft("00:00"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [share]);

  // Clean up map when expired
  useEffect(() => {
    if (status === "expired") {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      mapLoadedRef.current = false;
    }
  }, [status]);

  // Map + marker with smooth animation
  useEffect(() => {
    if (status !== "active" || !location || !containerRef.current || !mapboxgl) return;
    injectStyles();

    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLE_STREETS,
        center: [location.longitude, location.latitude],
        zoom: 16,
        attributionControl: false,
        pitch: 0,
        bearing: 0,
      });
      mapRef.current.on("load", () => {
        mapLoadedRef.current = true;
        enhancePOILayers(mapRef.current!);
      });
      mapRef.current.on("dragstart", () => setFollowing(false));
    }

    const isPanic = share?.tipo === "panico";
    const firstName = userInfo?.nome_completo?.split(" ")[0] || "";
    const avatarUrl = userInfo?.avatar_url || "";
    const recentLocation = Date.now() - new Date(location.created_at).getTime() < 60_000;
    const position: [number, number] = [location.longitude, location.latitude];

    const needsVisualUpdate = !markerContentRef.current
      || markerContentRef.current.avatarUrl !== avatarUrl
      || markerContentRef.current.panicActive !== isPanic
      || markerContentRef.current.recentLocation !== recentLocation;

    const heading = location.heading;
    const rotation = heading != null && heading > 0 ? `rotate(${heading}deg)` : "";

    if (markerRef.current) {
      const from = prevPosRef.current || position;
      smoothPanMarker(markerRef.current, from, position, 800);

      if (needsVisualUpdate) {
        const dotClass = isPanic ? "ampara-nav-dot ampara-nav-dot-panic" : recentLocation ? "ampara-nav-dot ampara-nav-dot-active" : "ampara-nav-dot";
        const dot = markerRef.current.getElement().querySelector(".ampara-nav-dot");
        if (dot) dot.className = dotClass;
        markerContentRef.current = { avatarUrl, panicActive: isPanic, recentLocation };
      }

      // Update rotation
      const markerInner = markerRef.current.getElement().querySelector(".ampara-nav-marker") as HTMLElement | null;
      if (markerInner) markerInner.style.transform = rotation;
    } else {
      const initial = firstName.charAt(0).toUpperCase() || "?";
      const dotClass = isPanic ? "ampara-nav-dot ampara-nav-dot-panic" : recentLocation ? "ampara-nav-dot ampara-nav-dot-active" : "ampara-nav-dot";

      const el = document.createElement("div");
      el.className = "ampara-nav-marker";
      if (rotation) el.style.transform = rotation;

      const dot = document.createElement("div");
      dot.className = dotClass;

      if (avatarUrl) {
        const img = new Image();
        img.className = "ampara-nav-img";
        img.alt = firstName;
        img.crossOrigin = "anonymous";
        img.onerror = () => {
          img.remove();
          const placeholder = document.createElement("div");
          placeholder.className = "ampara-nav-placeholder";
          placeholder.textContent = initial;
          dot.appendChild(placeholder);
        };
        img.src = avatarUrl;
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
      markerContentRef.current = { avatarUrl, panicActive: isPanic, recentLocation };
    }


    if (following) {
      mapRef.current.panTo(position);
    }

    prevPosRef.current = position;
  }, [location, share, userInfo, mapboxgl, recentLocs, tick, following]);

  // Track whether marker is off-screen and compute edge-clamped position
  useEffect(() => {
    if (!mapRef.current || !location) return;
    const map = mapRef.current;

    const checkVisibility = () => {
      const point = map.project([location.longitude, location.latitude]);
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const margin = 40;
      const pad = 28;

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
  }, [location]);

  const recenter = useCallback(() => {
    if (!mapRef.current || !location) return;
    setFollowing(true);
    mapRef.current.panTo([location.longitude, location.latitude]);
    mapRef.current.setZoom(16);
  }, [location]);

  // Computed values for HUD
  const effectiveSpeed = location ? (location.speed ?? estimateSpeed(recentLocs)) : null;
  const speedKmh = effectiveSpeed != null ? Math.round((effectiveSpeed < 50 ? effectiveSpeed * 3.6 : effectiveSpeed)) : 0;
  const movement = classifyMovement(effectiveSpeed);
  const isPanic = share?.tipo === "panico";
  const isRecent = location ? Date.now() - new Date(location.created_at).getTime() < 60_000 : false;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="rounded-2xl bg-card border border-border shadow-sm p-8 flex flex-col items-center gap-4 max-w-sm w-full">
          <img src={amparaIcon} alt="Ampara" className="w-14 h-14 opacity-50" />
          <h1 className="text-lg font-bold text-foreground">Link não encontrado</h1>
          <p className="text-sm text-muted-foreground text-center">Este código de rastreamento não existe ou expirou.</p>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 animate-fade-in">
        <div className="rounded-2xl bg-card border border-border shadow-sm p-8 flex flex-col items-center gap-4 max-w-sm w-full animate-scale-in">
          <img src={amparaIcon} alt="Ampara" className="w-14 h-14 opacity-50" />
          <h1 className="text-lg font-bold text-foreground">Rastreamento encerrado</h1>
          <p className="text-sm text-muted-foreground text-center">O compartilhamento de localização expirou ou foi desativado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Full-screen map */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Top bar — compact GPS style */}
      <div className="absolute top-0 left-0 right-0 z-10 p-3">
        <div className={`flex items-center justify-between rounded-2xl px-4 py-2.5 backdrop-blur-xl shadow-2xl ${isPanic ? "bg-red-950/90 border border-red-800/40" : "bg-black/80 border border-white/10"}`}>
          <div className="flex items-center gap-3 min-w-0">
            {userInfo && (
              <div className="shrink-0 h-8 w-8 rounded-full overflow-hidden ring-2 ring-white/20">
                {userInfo.avatar_url ? (
                  <img src={userInfo.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-zinc-700 flex items-center justify-center text-white text-xs font-bold">
                    {userInfo.nome_completo.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {userInfo?.nome_completo.split(" ")[0] || ""}
              </p>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isRecent ? "bg-green-400 animate-pulse" : "bg-zinc-500"}`} />
                <span className="text-[10px] text-zinc-400">
                  {isPanic ? "🚨 PÂNICO" : isRecent ? "Ao vivo" : `há ${formatRelativeTime(location?.created_at || "")}`}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right flex items-center gap-3">
            <div>
              <p className="text-lg font-mono font-bold text-white leading-none">{timeLeft}</p>
              <p className="text-[9px] text-zinc-500 text-right">restante</p>
            </div>
          </div>
        </div>
      </div>

      {/* Directional arrow when marker is off-screen */}
      {offScreenInfo && location && (
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
      {location && (
        <button
          onClick={recenter}
          className="absolute right-4 bottom-44 z-10 w-11 h-11 rounded-full bg-black/80 backdrop-blur-md border border-white/10 shadow-2xl flex items-center justify-center text-white hover:bg-black/90 transition-all active:scale-95"
          title="Centralizar"
        >
          <Locate className="w-5 h-5" />
        </button>
      )}

      {/* Bottom HUD — GPS navigator style */}
      {location && (
        <div className="absolute bottom-0 left-0 right-0 z-10 p-3 pb-safe">
          <div className={`rounded-2xl backdrop-blur-xl shadow-2xl border overflow-hidden ${isPanic ? "bg-red-950/90 border-red-800/40" : "bg-black/80 border-white/10"}`}>
            {/* Speed + Status bar */}
            <div className="flex items-stretch">
              {/* Speedometer */}
              <div className={`flex flex-col items-center justify-center px-5 py-3 border-r ${isPanic ? "border-red-800/30" : "border-white/10"}`}>
                <span className="text-3xl font-mono font-black text-white leading-none">
                  {speedKmh}
                </span>
                <span className="text-[9px] text-zinc-500 font-medium tracking-wider uppercase mt-0.5">km/h</span>
              </div>

              {/* Info column */}
              <div className="flex-1 min-w-0 px-4 py-2.5 flex flex-col justify-center gap-1">
                {/* Movement status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">{isPanic ? "🚨" : movement.emoji}</span>
                  <span className="text-sm font-semibold text-white">
                    {isPanic ? "Pânico Ativo" : movement.label}
                  </span>
                </div>

                {/* Address */}
                {address && (
                  <p className="text-[11px] text-zinc-400 leading-snug break-words">{address}</p>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {location.precisao_metros != null && (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Signal className="w-3 h-3" />
                      ±{Math.round(location.precisao_metros)}m
                    </span>
                  )}
                  {stationarySince && (
                    <span className="text-[10px] text-zinc-500">
                      📍 Parada há {formatRelativeTime(stationarySince)}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-500">
                    🕐 {formatRelativeTime(location.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
