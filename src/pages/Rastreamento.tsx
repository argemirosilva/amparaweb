import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import amparaIcon from "@/assets/ampara-icon-transparent.png";

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
  const [timeLeft, setTimeLeft] = useState("");
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      if (!data.ativo || new Date(data.expira_em) < new Date()) {
        setStatus("expired"); return;
      }
      setShare(data as ShareData);
      setStatus("active");

      // Fetch user info (name + avatar)
      const { data: userData } = await supabase
        .from("usuarios")
        .select("nome_completo, avatar_url")
        .eq("id", data.user_id)
        .maybeSingle();
      if (userData) setUserInfo(userData);
    };
    fetchShare();
  }, [codigo]);

  // Fetch latest location & subscribe to updates
  useEffect(() => {
    if (!share) return;

    const fetchLocation = async () => {
      const { data } = await supabase
        .from("localizacoes")
        .select("latitude, longitude, precisao_metros, created_at")
        .eq("user_id", share.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLocation(data);
    };
    fetchLocation();

    // Realtime subscription
    const channel = supabase
      .channel(`track-${share.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "localizacoes", filter: `user_id=eq.${share.user_id}` },
        (payload) => {
          const d = payload.new as any;
          setLocation({ latitude: d.latitude, longitude: d.longitude, precisao_metros: d.precisao_metros, created_at: d.created_at });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "compartilhamento_gps", filter: `id=eq.${share.id}` },
        (payload) => {
          const updated = payload.new as any;
          if (!updated.ativo) setStatus("expired");
        }
      )
      .subscribe();

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

  // Leaflet map
  useEffect(() => {
    if (!location || !containerRef.current) return;

    const initMap = async () => {
      const L = await import("leaflet");
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current!, {
          center: [location.latitude, location.longitude],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapRef.current);
      }

      // Inject ampara-marker styles (same as Mapa.tsx) once
      if (!document.getElementById("ampara-marker-styles")) {
        const style = document.createElement("style");
        style.id = "ampara-marker-styles";
        style.textContent = `
          .ampara-marker {
            display: flex; flex-direction: column; align-items: center; gap: 2px;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
          }
          .ampara-marker-ring-wrapper { position: relative; display: inline-flex; }
          .ampara-marker-ring {
            width: 52px; height: 52px; border-radius: 50%; padding: 3px;
            background: linear-gradient(135deg, hsl(280 70% 50%), hsl(320 80% 55%));
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0; overflow: hidden;
          }
          .ampara-marker-active .ampara-marker-ring {
            animation: ampara-pulse-blue 2s ease-in-out infinite;
          }
          @keyframes ampara-pulse-blue {
            0%, 100% { box-shadow: 0 0 0 0 hsla(220, 80%, 55%, 0.5); }
            50% { box-shadow: 0 0 0 10px hsla(220, 80%, 55%, 0); }
          }
          .ampara-panic-badge {
            position: absolute; top: -4px; right: -4px;
            width: 20px; height: 20px; border-radius: 50%;
            background: hsl(0 80% 50%); color: white;
            font-size: 13px; font-weight: 900;
            display: flex; align-items: center; justify-content: center;
            border: 2px solid white;
            animation: ampara-badge-pulse 1s ease-in-out infinite; z-index: 10;
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
            width: 44px; height: 44px; min-width: 44px; min-height: 44px;
            border-radius: 50%; object-fit: cover; aspect-ratio: 1;
          }
          .ampara-marker-placeholder {
            display: flex; align-items: center; justify-content: center;
            background: hsl(240 5% 26%); color: white; font-weight: 700; font-size: 18px;
          }
          .ampara-marker-info {
            display: flex; flex-direction: column; align-items: center;
            background: hsl(0 0% 10% / 0.85); backdrop-filter: blur(4px);
            border-radius: 8px; padding: 3px 8px; max-width: 180px;
          }
          .ampara-marker-name { color: white; font-size: 11px; font-weight: 700; line-height: 1.2; }
          .ampara-marker-status { color: hsl(0 0% 80%); font-size: 10px; line-height: 1.2; }
          .leaflet-control-attribution, .leaflet-control-attribution a { display: none !important; }
        `;
        document.head.appendChild(style);
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

      const html = `
        <div class="ampara-marker ${pulseClass}">
          <div class="ampara-marker-ring-wrapper">
            <div class="ampara-marker-ring">${imgHtml}</div>
            ${panicBadge}
          </div>
          <div class="ampara-marker-info">
            <span class="ampara-marker-name">${firstName}</span>
            <span class="ampara-marker-status">${isPanic ? "🚨 Pânico" : "📍 Ao vivo"}</span>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: "",
        iconSize: [180, 120],
        iconAnchor: [90, 60],
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([location.latitude, location.longitude]);
        markerRef.current.setIcon(icon);
      } else {
        markerRef.current = L.marker([location.latitude, location.longitude], { icon }).addTo(mapRef.current);
      }
      mapRef.current.setView([location.latitude, location.longitude], mapRef.current.getZoom());
    };

    initMap();
  }, [location, share, userInfo]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-4 p-6">
        <img src={amparaIcon} alt="Ampara" className="w-16 h-16 opacity-60" />
        <h1 className="text-xl font-bold">Link não encontrado</h1>
        <p className="text-sm text-zinc-400 text-center">Este código de rastreamento não existe ou foi removido.</p>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white gap-4 p-6">
        <img src={amparaIcon} alt="Ampara" className="w-16 h-16 opacity-60" />
        <h1 className="text-xl font-bold">Rastreamento encerrado</h1>
        <p className="text-sm text-zinc-400 text-center">O compartilhamento de localização expirou ou foi desativado.</p>
      </div>
    );
  }

  const isPanic = share?.tipo === "panico";

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white">
      {/* Map */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 backdrop-blur-md ${isPanic ? "bg-red-900/80" : "bg-zinc-900/80"}`}>
          <div className="flex items-center gap-3">
            <img src={amparaIcon} alt="Ampara" className="w-8 h-8" />
            <div>
              <p className="text-xs font-medium opacity-70">
                {isPanic ? "🚨 ALERTA DE PÂNICO" : "📍 Rastreamento Ativo"}
              </p>
              <p className="text-[10px] opacity-50">Código: {share?.codigo}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-mono font-bold">{timeLeft}</p>
            <p className="text-[10px] opacity-50">restante</p>
          </div>
        </div>
      </div>

      {/* Bottom info */}
      {location && (
        <div className="absolute bottom-6 left-4 right-4 z-10">
          <div className="rounded-xl bg-zinc-900/80 backdrop-blur-md px-4 py-3">
            <p className="text-xs text-zinc-400">Última atualização</p>
            <p className="text-sm font-medium">
              {new Date(location.created_at).toLocaleTimeString("pt-BR")}
            </p>
            {location.precisao_metros && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Precisão: ~{Math.round(location.precisao_metros)}m
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
