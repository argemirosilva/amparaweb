/// <reference types="google.maps" />
import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveAddress } from "@/services/reverseGeocodeService";
import { classifyMovement } from "@/hooks/useMovementStatus";
import { useGoogleMapsPublic } from "@/hooks/useGoogleMaps";
import amparaIcon from "@/assets/ampara-icon-transparent.png";

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

// Inject styles once
const STYLE_ID = "ampara-gmap-marker-styles";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .ampara-marker { display:flex; flex-direction:column; align-items:center; gap:2px; filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3)); }
    .ampara-marker-ring-wrapper { position:relative; display:inline-flex; }
    .ampara-marker-ring { width:52px; height:52px; border-radius:50%; padding:3px; background:linear-gradient(135deg,hsl(280 70% 50%),hsl(320 80% 55%)); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; }
    .ampara-marker-active .ampara-marker-ring { animation:ampara-pulse-blue 2s ease-in-out infinite; }
    @keyframes ampara-pulse-blue { 0%,100%{box-shadow:0 0 0 0 hsla(220,80%,55%,0.5);} 50%{box-shadow:0 0 0 10px hsla(220,80%,55%,0);} }
    .ampara-panic-badge { position:absolute; top:-4px; right:-4px; width:20px; height:20px; border-radius:50%; background:hsl(0 80% 50%); color:white; font-size:13px; font-weight:900; display:flex; align-items:center; justify-content:center; border:2px solid white; animation:ampara-badge-pulse 1s ease-in-out infinite; z-index:10; }
    @keyframes ampara-badge-pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.2);} }
    .ampara-marker-panic .ampara-marker-ring { background:hsl(0 80% 50%); animation:ampara-pulse 1.2s ease-in-out infinite; }
    @keyframes ampara-pulse { 0%,100%{box-shadow:0 0 0 0 hsla(0,80%,50%,0.6);} 50%{box-shadow:0 0 0 14px hsla(0,80%,50%,0);} }
    .ampara-marker-img { width:44px; height:44px; min-width:44px; min-height:44px; border-radius:50%; object-fit:cover; aspect-ratio:1; }
    .ampara-marker-placeholder { display:flex; align-items:center; justify-content:center; background:hsl(240 5% 26%); color:white; font-weight:700; font-size:18px; }
    .ampara-marker-info { display:flex; flex-direction:column; align-items:center; background:hsl(0 0% 10%/0.85); backdrop-filter:blur(4px); border-radius:8px; padding:3px 8px; max-width:200px; }
    .ampara-marker-name { color:white; font-size:11px; font-weight:700; line-height:1.2; }
    .ampara-marker-status { color:hsl(0 0% 80%); font-size:10px; line-height:1.2; }
    .ampara-marker-address { color:hsl(0 0% 65%); font-size:9px; line-height:1.3; text-align:center; max-width:190px; word-wrap:break-word; white-space:normal; }
    .ampara-marker-time { color:hsl(0 0% 55%); font-size:9px; line-height:1.2; text-align:center; }
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
  created_at: string;
}

interface UserInfo {
  nome_completo: string;
  avatar_url: string | null;
}

export default function Rastreamento() {
  const { codigo } = useParams<{ codigo: string }>();
  const [share, setShare] = useState<ShareData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "active" | "expired" | "not_found">("loading");
  const [address, setAddress] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState("");
  const [stationarySince, setStationarySince] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
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
        .select("latitude, longitude, precisao_metros, speed, created_at")
        .eq("user_id", share.user_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (locs && locs.length > 0) {
        const latest = locs[0];
        setLocation(latest);
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
        const loc = { latitude: d.latitude, longitude: d.longitude, precisao_metros: d.precisao_metros, speed: d.speed, created_at: d.created_at };
        setLocation(loc);
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

  // Google Map
  useEffect(() => {
    if (!location || !containerRef.current || !maps) return;
    injectStyles();

    if (!mapRef.current) {
      mapRef.current = new maps.Map(containerRef.current, {
        center: { lat: location.latitude, lng: location.longitude },
        zoom: 16,
        mapId: "ampara-tracking-map",
        disableDefaultUI: true,
      });
    }

    const isPanic = share?.tipo === "panico";
    const firstName = userInfo?.nome_completo?.split(" ")[0] || "";
    const avatarUrl = userInfo?.avatar_url || "";
    const recentLocation = Date.now() - new Date(location.created_at).getTime() < 60_000;
    const imgHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="ampara-marker-img" alt="${firstName}" />`
      : `<div class="ampara-marker-img ampara-marker-placeholder">${firstName.charAt(0).toUpperCase() || "?"}</div>`;
    const pulseClass = isPanic ? "ampara-marker-panic" : recentLocation ? "ampara-marker-active" : "";
    const panicBadge = isPanic ? `<div class="ampara-panic-badge">!</div>` : "";
    const movement = classifyMovement(location.speed);
    const stationaryText = stationarySince ? `📍 Neste local há ${formatRelativeTime(stationarySince)}` : "";
    const updateText = `🕐 Atualizado há ${formatRelativeTime(location.created_at)}`;

    const content = document.createElement("div");
    content.innerHTML = `
      <div class="ampara-marker ${pulseClass}">
        <div class="ampara-marker-ring-wrapper">
          <div class="ampara-marker-ring">${imgHtml}</div>
          ${panicBadge}
        </div>
        <div class="ampara-marker-info">
          <span class="ampara-marker-name">${firstName}</span>
          <span class="ampara-marker-status">${isPanic ? "🚨 Pânico" : `${movement.emoji} ${movement.label}`}</span>
          ${address ? `<span class="ampara-marker-address">${address}</span>` : ""}
          ${stationaryText ? `<span class="ampara-marker-time">${stationaryText}</span>` : ""}
          <span class="ampara-marker-time">${updateText}</span>
        </div>
      </div>
    `;

    const position = { lat: location.latitude, lng: location.longitude };
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
  }, [location, share, userInfo, address, stationarySince, maps]);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="rounded-2xl bg-card border border-border shadow-sm p-8 flex flex-col items-center gap-4 max-w-sm w-full">
          <img src={amparaIcon} alt="Ampara" className="w-14 h-14 opacity-50" />
          <h1 className="text-lg font-bold text-foreground">Rastreamento encerrado</h1>
          <p className="text-sm text-muted-foreground text-center">O compartilhamento de localização expirou ou foi desativado.</p>
        </div>
      </div>
    );
  }

  const isPanic = share?.tipo === "panico";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className={`flex items-center justify-between rounded-2xl px-4 py-3 backdrop-blur-md shadow-lg ${isPanic ? "bg-red-950/90 border border-red-800/50" : "bg-zinc-950/90 border border-zinc-800/50"}`}>
          <div className="flex items-center gap-3 min-w-0">
            {userInfo && (
              <div className="shrink-0 h-9 w-9 rounded-full p-[2px]" style={{ background: "linear-gradient(135deg, hsl(280 70% 50%), hsl(320 80% 55%))" }}>
                {userInfo.avatar_url ? (
                  <img src={userInfo.avatar_url} alt={userInfo.nome_completo} className="h-full w-full rounded-full object-cover bg-zinc-800" />
                ) : (
                  <div className="h-full w-full rounded-full bg-zinc-700 flex items-center justify-center text-white text-sm font-bold">
                    {userInfo.nome_completo.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-200 truncate">
                {userInfo ? `${userInfo.nome_completo.split(" ")[0]} · ` : ""}{isPanic ? "🚨 Pânico" : "📍 Ao vivo"}
              </p>
              <p className="text-[10px] text-zinc-500">Código: {share?.codigo}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono font-bold text-white">{timeLeft}</p>
            <p className="text-[10px] text-zinc-500">restante</p>
          </div>
        </div>
      </div>
      {location && (
        <div className="absolute bottom-6 left-4 right-4 z-10">
          <div className="rounded-2xl bg-card/85 backdrop-blur-md border border-border/50 shadow-sm px-4 py-3">
            <p className="text-xs text-muted-foreground">Última atualização</p>
            <p className="text-sm font-medium text-foreground">{new Date(location.created_at).toLocaleTimeString("pt-BR")}</p>
            {location.precisao_metros && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Precisão: ~{Math.round(location.precisao_metros)}m</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
