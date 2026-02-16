import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

// We load mapbox-gl dynamically to handle the CSS import
let mapboxgl: typeof import("mapbox-gl").default | null = null;

export default function TransparenciaMapa() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [period, setPeriod] = useState("90d");
  const [uf, setUf] = useState("");

  // Stats mock (would be computed from aggregated data)
  const regionStats = {
    total: 142,
    emergencias: 23,
    nivel: "amarelo" as const,
    tendencia: "+8%",
  };

  useEffect(() => {
    async function initMap() {
      if (!mapContainer.current || mapRef.current) return;

      const mb = await import("mapbox-gl");
      mapboxgl = mb.default;

      // Fetch token from edge function
      const tokenRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mapbox-token`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      let token = "";
      if (tokenRes.ok) {
        const data = await tokenRes.json();
        token = data.token;
      }

      if (!token) {
        console.warn("Mapbox token not available");
        return;
      }

      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-53, -14],
        zoom: 3.8,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("load", () => {
        setMapLoaded(true);
      });

      mapRef.current = map;
    }

    initMap();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px-57px)]" style={fontStyle}>
      {/* Map */}
      <div className="flex-1 md:w-[70%] relative">
        <div ref={mapContainer} className="w-full h-full min-h-[400px]" />
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(210 17% 96%)" }}>
            <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Carregando mapa…</p>
          </div>
        )}
      </div>

      {/* Sidebar panel */}
      <div
        className="w-full md:w-[30%] md:max-w-sm border-t md:border-t-0 md:border-l overflow-y-auto p-4"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: "hsl(220 13% 18%)" }}>
          Filtros
        </h2>

        {/* Period */}
        <div className="mb-3">
          <label className="text-xs font-medium block mb-1" style={{ color: "hsl(220 9% 46%)" }}>
            Período
          </label>
          <div className="flex gap-1 flex-wrap">
            {["7d", "30d", "90d", "12m"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 text-xs rounded border transition-colors"
                style={{
                  borderColor: period === p ? "hsl(224 76% 33%)" : "hsl(220 13% 91%)",
                  background: period === p ? "hsl(224 76% 33%)" : "transparent",
                  color: period === p ? "#fff" : "hsl(220 9% 46%)",
                  fontWeight: period === p ? 600 : 400,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* UF */}
        <div className="mb-4">
          <label className="text-xs font-medium block mb-1" style={{ color: "hsl(220 9% 46%)" }}>
            UF
          </label>
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            style={{
              borderColor: "hsl(220 13% 91%)",
              color: "hsl(220 13% 18%)",
              background: "hsl(0 0% 100%)",
            }}
          >
            <option value="">Todas</option>
            {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <hr style={{ borderColor: "hsl(220 13% 91%)" }} className="mb-4" />

        {/* Region summary */}
        <h3 className="text-sm font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
          {selectedRegion || "Brasil"}
        </h3>
        <div className="space-y-2 text-xs" style={{ color: "hsl(220 9% 46%)" }}>
          <div className="flex justify-between">
            <span>Total de eventos</span>
            <span className="font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{regionStats.total}</span>
          </div>
          <div className="flex justify-between">
            <span>Emergências</span>
            <span className="font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{regionStats.emergencias}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Nível predominante</span>
            <GovStatusBadge status={regionStats.nivel} label="Moderado" />
          </div>
          <div className="flex justify-between">
            <span>Tendência</span>
            <span className="font-medium" style={{ color: "hsl(0 73% 42%)" }}>
              {regionStats.tendencia}
            </span>
          </div>
        </div>

        <hr style={{ borderColor: "hsl(220 13% 91%)" }} className="my-4" />

        {/* Municipalities table */}
        <h3 className="text-sm font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
          Municípios em destaque
        </h3>
        <div className="space-y-1">
          {[
            { nome: "Porto Velho - RO", eventos: 28 },
            { nome: "Ji-Paraná - RO", eventos: 19 },
            { nome: "Ariquemes - RO", eventos: 14 },
          ].map((m) => (
            <div
              key={m.nome}
              className="flex items-center justify-between px-2 py-1.5 rounded text-xs"
              style={{ background: "hsl(210 17% 96%)" }}
            >
              <span style={{ color: "hsl(220 13% 18%)" }}>{m.nome}</span>
              <span className="font-semibold" style={{ color: "hsl(224 76% 33%)" }}>{m.eventos}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
