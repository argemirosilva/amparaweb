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

export default function Rastreamento() {
  const { codigo } = useParams<{ codigo: string }>();
  const [share, setShare] = useState<ShareData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
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

      const isPanic = share?.tipo === "panico";
      const pulseColor = isPanic ? "hsl(0,80%,50%)" : "hsl(220,80%,55%)";
      const pulseAnim = isPanic ? "track-pulse-red" : "track-pulse-blue";

      // Inject styles once
      if (!document.getElementById("track-marker-styles")) {
        const style = document.createElement("style");
        style.id = "track-marker-styles";
        style.textContent = `
          .track-marker { display:flex; align-items:center; justify-content:center; }
          .track-ring {
            width:40px; height:40px; border-radius:50%;
            border:3px solid ${pulseColor};
            display:flex; align-items:center; justify-content:center;
            background:white;
            animation: ${pulseAnim} 2s ease-in-out infinite;
          }
          .track-ring img { width:28px; height:28px; }
          @keyframes track-pulse-blue {
            0%,100% { box-shadow:0 0 0 0 hsla(220,80%,55%,0.5); }
            50% { box-shadow:0 0 0 12px hsla(220,80%,55%,0); }
          }
          @keyframes track-pulse-red {
            0%,100% { box-shadow:0 0 0 0 hsla(0,80%,50%,0.5); }
            50% { box-shadow:0 0 0 12px hsla(0,80%,50%,0); }
          }
        `;
        document.head.appendChild(style);
      }

      const icon = L.divIcon({
        className: "track-marker",
        html: `<div class="track-ring"><img src="${amparaIcon}" alt=""/></div>`,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([location.latitude, location.longitude]);
      } else {
        markerRef.current = L.marker([location.latitude, location.longitude], { icon }).addTo(mapRef.current);
      }
      mapRef.current.setView([location.latitude, location.longitude], mapRef.current.getZoom());
    };

    initMap();
  }, [location, share]);

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
