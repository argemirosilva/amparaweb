/// <reference types="google.maps" />
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveAddress } from "@/services/reverseGeocodeService";
import { classifyMovement } from "@/hooks/useMovementStatus";
import { useGoogleMapsPublic } from "@/hooks/useGoogleMaps";
import amparaIcon from "@/assets/ampara-icon-transparent.png";
import { Navigation, Locate, Signal } from "lucide-react";

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

const STYLE_ID = "ampara-gmap-nav-styles";
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
    .ampara-accuracy-circle { border-radius:50%; background:hsla(220,80%,55%,0.08); border:1.5px solid hsla(220,80%,55%,0.25); position:absolute; transform:translate(-50%,-50%); pointer-events:none; }
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
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
    marker.position = {
      lat: from.lat + (to.lat - from.lat) * ease,
      lng: from.lng + (to.lng - from.lng) * ease,
    };
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
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const accuracyCircleRef = useRef<google.maps.Circle | null>(null);
  const prevPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { maps } = useGoogleMapsPublic();

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
      if (userData) setUserInfo(userData);
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
        setRecentLocs(prev => [loc, ...prev].slice(0, 5));
        resolveAddress(loc.latitude, loc.longitude).then(geo => { setAddress(geo?.display_address || "Localizando..."); });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "compartilhamento_gps", filter: `id=eq.${share.id}` }, (payload) => {
        const updated = payload.new as any;
        if (!updated.ativo) {
          if (markerRef.current) { markerRef.current.map = null; markerRef.current = null; }
          setStatus("expired");
        }
      });

    if (share.alerta_id) {
      channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "alertas_panico", filter: `id=eq.${share.alerta_id}` }, (payload) => {
        const updated = payload.new as any;
        if (updated.status !== "ativo") {
          if (markerRef.current) { markerRef.current.map = null; markerRef.current = null; }
          setStatus("expired");
        }
      });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [share]);

  // Refresh relative times every 5s (faster for GPS feel)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  // Stop following when user drags map
  useEffect(() => {
    if (!mapRef.current || !maps) return;
    const listener = mapRef.current.addListener("dragstart", () => setFollowing(false));
    return () => google.maps.event.removeListener(listener);
  }, [maps, mapRef.current]);

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
      if (markerRef.current) { markerRef.current.map = null; markerRef.current = null; }
      if (accuracyCircleRef.current) { accuracyCircleRef.current.setMap(null); accuracyCircleRef.current = null; }
      mapRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    }
  }, [status]);

  // Google Map + marker with smooth animation
  useEffect(() => {
    if (status !== "active" || !location || !containerRef.current || !maps) return;
    injectStyles();

    if (!mapRef.current) {
      mapRef.current = new maps.Map(containerRef.current, {
        center: { lat: location.latitude, lng: location.longitude },
        zoom: 17,
        mapId: "ampara-tracking-map",
        disableDefaultUI: true,
        gestureHandling: "greedy",
      });
    }

    const isPanic = share?.tipo === "panico";
    const firstName = userInfo?.nome_completo?.split(" ")[0] || "";
    const avatarUrl = userInfo?.avatar_url || "";
    const recentLocation = Date.now() - new Date(location.created_at).getTime() < 60_000;
    const imgHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="ampara-nav-img" alt="${firstName}" />`
      : `<div class="ampara-nav-placeholder">${firstName.charAt(0).toUpperCase() || "?"}</div>`;
    const dotClass = isPanic ? "ampara-nav-dot ampara-nav-dot-panic" : recentLocation ? "ampara-nav-dot ampara-nav-dot-active" : "ampara-nav-dot";

    const heading = location.heading;
    const rotation = heading != null && heading > 0 ? `transform:rotate(${heading}deg)` : "";

    const content = document.createElement("div");
    content.innerHTML = `
      <div class="ampara-nav-marker" style="${rotation}">
        <div class="${dotClass}">${imgHtml}</div>
        <div class="ampara-nav-arrow"></div>
      </div>
    `;

    const position = { lat: location.latitude, lng: location.longitude };

    if (markerRef.current) {
      // Smooth animate from previous position
      const from = prevPosRef.current || position;
      smoothPanMarker(markerRef.current, from, position, 800);
      markerRef.current.content = content;
    } else {
      markerRef.current = new maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        content,
      });
    }

    // Accuracy circle
    const accuracy = location.precisao_metros ?? 20;
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setCenter(position);
      accuracyCircleRef.current.setRadius(accuracy);
    } else {
      accuracyCircleRef.current = new maps.Circle({
        map: mapRef.current,
        center: position,
        radius: accuracy,
        fillColor: isPanic ? "#ef4444" : "#3b82f6",
        fillOpacity: 0.08,
        strokeColor: isPanic ? "#ef4444" : "#3b82f6",
        strokeOpacity: 0.25,
        strokeWeight: 1.5,
        clickable: false,
      });
    }

    // Follow mode: smooth pan
    if (following) {
      mapRef.current.panTo(position);
    }

    prevPosRef.current = position;
  }, [location, share, userInfo, maps, recentLocs, tick, following]);

  const recenter = useCallback(() => {
    if (!mapRef.current || !location) return;
    setFollowing(true);
    mapRef.current.panTo({ lat: location.latitude, lng: location.longitude });
    mapRef.current.setZoom(17);
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
          <p className="text-sm text-muted-foreground text-center">Este código de rastreamento não existe ou foi removido.</p>
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

      {/* Re-center button */}
      {!following && (
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
              <div className="flex-1 px-4 py-2.5 flex flex-col justify-center gap-1">
                {/* Movement status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm">{isPanic ? "🚨" : movement.emoji}</span>
                  <span className="text-sm font-semibold text-white">
                    {isPanic ? "Pânico Ativo" : movement.label}
                  </span>
                </div>

                {/* Address */}
                {address && (
                  <p className="text-[11px] text-zinc-400 truncate leading-tight">{address}</p>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-3 mt-0.5">
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
