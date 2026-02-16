import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const BRAZIL_GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

interface UfStats {
  eventos: number;
  emergencias: number;
  monitoradas: number;
}

type StatsMap = Record<string, UfStats>;

// Map GeoJSON state names to UF codes
const STATE_NAME_TO_UF: Record<string, string> = {
  Acre: "AC", Alagoas: "AL", Amapá: "AP", Amazonas: "AM", Bahia: "BA",
  Ceará: "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", Goiás: "GO",
  Maranhão: "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", Pará: "PA", Paraíba: "PB", Paraná: "PR",
  Pernambuco: "PE", Piauí: "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", Rondônia: "RO",
  Roraima: "RR", "Santa Catarina": "SC", "São Paulo": "SP", Sergipe: "SE",
  Tocantins: "TO",
};

function getColorForValue(value: number): string {
  if (value === 0) return "#e5e7eb";
  if (value >= 15) return "#dc2626";
  if (value >= 6) return "#f97316";
  if (value >= 3) return "#facc15";
  return "#4ade80";
}

function getLevelLabel(value: number, max: number): { status: "verde" | "amarelo" | "vermelho"; label: string } {
  if (max === 0 || value === 0) return { status: "verde", label: "Sem dados" };
  const ratio = value / max;
  if (ratio > 0.5) return { status: "vermelho", label: "Alto" };
  if (ratio > 0.25) return { status: "amarelo", label: "Moderado" };
  return { status: "verde", label: "Baixo" };
}

export default function TransparenciaMapa() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [period, setPeriod] = useState("90d");
  const [filterUf, setFilterUf] = useState("");
  const [stats, setStats] = useState<StatsMap>({});
  const [geojson, setGeojson] = useState<any>(null);
  const [municipios, setMunicipios] = useState<{ nome: string; eventos: number }[]>([]);

  // Load GeoJSON once
  useEffect(() => {
    fetch(BRAZIL_GEOJSON_URL)
      .then((r) => r.json())
      .then((data) => {
        // Add uf_code property
        data.features = data.features.map((f: any) => ({
          ...f,
          properties: {
            ...f.properties,
            uf_code: STATE_NAME_TO_UF[f.properties.name] || f.properties.name,
          },
        }));
        setGeojson(data);
      })
      .catch(console.error);
  }, []);

  // Load aggregated stats from DB
  useEffect(() => {
    const periodDays = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[period] || 90;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    async function loadStats() {
      // Get users with their UF
      const { data: users } = await supabase
        .from("usuarios")
        .select("id, endereco_uf, status");

      const userUfMap: Record<string, string> = {};
      const ufSet = new Set<string>();
      (users || []).forEach((u) => {
        if (u.endereco_uf) {
          userUfMap[u.id] = u.endereco_uf;
          ufSet.add(u.endereco_uf);
        }
      });

      // Get events and emergencies
      const [{ data: eventos }, { data: emergencias }] = await Promise.all([
        supabase.from("gravacoes_analises").select("user_id, created_at").gte("created_at", since),
        supabase.from("alertas_panico").select("user_id, criado_em").gte("criado_em", since),
      ]);

      const statsMap: StatsMap = {};
      // Init all UFs
      ufSet.forEach((uf) => {
        statsMap[uf] = { eventos: 0, emergencias: 0, monitoradas: 0 };
      });

      // Count active users per UF
      (users || []).forEach((u) => {
        if (u.endereco_uf && u.status === "ativo") {
          if (!statsMap[u.endereco_uf]) statsMap[u.endereco_uf] = { eventos: 0, emergencias: 0, monitoradas: 0 };
          statsMap[u.endereco_uf].monitoradas++;
        }
      });

      // Count events per UF
      (eventos || []).forEach((e) => {
        const uf = userUfMap[e.user_id];
        if (uf && statsMap[uf]) statsMap[uf].eventos++;
      });

      // Count emergencies per UF
      (emergencias || []).forEach((e) => {
        const uf = userUfMap[e.user_id];
        if (uf && statsMap[uf]) statsMap[uf].emergencias++;
      });

      setStats(statsMap);
    }

    loadStats();
  }, [period]);

  // Load municipios for selected UF
  useEffect(() => {
    if (!selectedUf) {
      setMunicipios([]);
      return;
    }

    async function loadMunicipios() {
      const periodDays = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[period] || 90;
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: users } = await supabase
        .from("usuarios")
        .select("id, endereco_cidade")
        .eq("endereco_uf", selectedUf);

      const userIds = (users || []).map((u) => u.id);
      if (userIds.length === 0) {
        setMunicipios([]);
        return;
      }

      const { data: eventos } = await supabase
        .from("gravacoes_analises")
        .select("user_id")
        .gte("created_at", since)
        .in("user_id", userIds);

      const cidadeMap: Record<string, number> = {};
      const userCidadeMap: Record<string, string> = {};
      (users || []).forEach((u) => {
        if (u.endereco_cidade) userCidadeMap[u.id] = u.endereco_cidade;
      });

      (eventos || []).forEach((e) => {
        const cidade = userCidadeMap[e.user_id];
        if (cidade) cidadeMap[cidade] = (cidadeMap[cidade] || 0) + 1;
      });

      const sorted = Object.entries(cidadeMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([nome, eventos]) => ({ nome: `${nome} - ${selectedUf}`, eventos }));

      setMunicipios(sorted);
    }

    loadMunicipios();
  }, [selectedUf, period]);

  // Init map
  useEffect(() => {
    async function initMap() {
      if (!mapContainer.current || mapRef.current) return;

      const mb = await import("mapbox-gl");
      const mapboxgl = mb.default;

      const tokenRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mapbox-token`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
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

      const brazilBounds: [[number, number], [number, number]] = [
        [-75, -35], // SW
        [-28, 6],   // NE
      ];

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          name: "Brazil Clean",
          sources: {
            "simple-tiles": {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
                "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
                "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
              ],
              tileSize: 256,
            },
          },
          layers: [
            {
              id: "simple-tiles-layer",
              type: "raster",
              source: "simple-tiles",
              minzoom: 0,
              maxzoom: 22,
            },
          ],
        },
        center: [-52, -15],
        zoom: 3.2,
        maxBounds: brazilBounds,
        minZoom: 2.8,
        fitBoundsOptions: { padding: 40 },
      });

      // Fit Brazil fully in view after load
      const brazilFitBounds: [[number, number], [number, number]] = [
        [-73.5, -33.7], // SW corner of Brazil
        [-34.8, 5.3],   // NE corner of Brazil
      ];
      map.once("load", () => {
        map.fitBounds(brazilFitBounds, { padding: 30, duration: 0 });
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("load", () => {
        // Hide country/territory labels to isolate Brazil
        const style = map.getStyle();
        if (style?.layers) {
          style.layers.forEach((layer: any) => {
            if (
              layer.type === "symbol" &&
              layer.id &&
              (layer.id.includes("country-label") ||
               layer.id.includes("state-label") ||
               layer.id.includes("continent-label"))
            ) {
              map.setLayoutProperty(layer.id, "visibility", "none");
            }
          });
        }
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

  // Update choropleth when data or geojson changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geojson) return;

    const maxEventos = Math.max(1, ...Object.values(stats).map((s) => s.eventos));

    // Enrich geojson with stats
    const enriched = {
      ...geojson,
      features: geojson.features.map((f: any) => {
        const uf = f.properties.uf_code;
        const s = stats[uf] || { eventos: 0, emergencias: 0, monitoradas: 0 };
        return {
          ...f,
          properties: {
            ...f.properties,
            eventos: s.eventos,
            emergencias: s.emergencias,
            monitoradas: s.monitoradas,
            fill_color: getColorForValue(s.eventos),
          },
        };
      }),
    };

    // Add or update source
    if (map.getSource("states")) {
      (map.getSource("states") as any).setData(enriched);
      // Also update label source with new event counts
      if (map.getSource("state-labels")) {
        const labelFeatures = enriched.features.map((f: any) => {
          const coords =
            f.geometry.type === "Polygon"
              ? f.geometry.coordinates[0]
              : f.geometry.coordinates.flat(1);
          const lngs = coords.map((c: number[]) => c[0]);
          const lats = coords.map((c: number[]) => c[1]);
          const center = [
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
            (Math.min(...lats) + Math.max(...lats)) / 2,
          ];
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: center },
            properties: { uf_code: f.properties.uf_code, eventos: f.properties.eventos || 0 },
          };
        });
        (map.getSource("state-labels") as any).setData({ type: "FeatureCollection", features: labelFeatures });
      }
    } else {
      map.addSource("states", { type: "geojson", data: enriched });

      map.addLayer({
        id: "states-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": [
            "step",
            ["get", "eventos"],
            "#e5e7eb",  // 0 events — light gray
            1, "#4ade80",   // 1+ — green
            3, "#facc15",   // 3+ — yellow
            6, "#f97316",   // 6+ — orange
            15, "#dc2626",  // 15+ — red
          ],
          "fill-opacity": 0.75,
        },
      });

      map.addLayer({
        id: "states-outline",
        type: "line",
        source: "states",
        paint: {
          "line-color": "hsl(220, 13%, 70%)",
          "line-width": 1,
        },
      });

      map.addLayer({
        id: "states-hover",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": "hsl(224, 76%, 33%)",
          "fill-opacity": 0.15,
        },
        filter: ["==", "uf_code", ""],
      });

      // UF labels — compute centroids from polygons
      const labelFeatures = enriched.features.map((f: any) => {
        const coords =
          f.geometry.type === "Polygon"
            ? f.geometry.coordinates[0]
            : f.geometry.coordinates.flat(1);
        const lngs = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        const center = [
          (Math.min(...lngs) + Math.max(...lngs)) / 2,
          (Math.min(...lats) + Math.max(...lats)) / 2,
        ];
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: center },
          properties: { uf_code: f.properties.uf_code, eventos: f.properties.eventos || 0 },
        };
      });

      map.addSource("state-labels", {
        type: "geojson",
        data: { type: "FeatureCollection", features: labelFeatures },
      });

      map.addLayer({
        id: "state-labels-layer",
        type: "symbol",
        source: "state-labels",
        layout: {
          "text-field": ["concat", ["get", "uf_code"], " (", ["to-string", ["get", "eventos"]], ")"],
          "text-size": 11,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: {
          "text-color": "hsl(220, 13%, 25%)",
          "text-halo-color": "hsl(0, 0%, 100%)",
          "text-halo-width": 1.5,
        },
      });

      // Hover effect
      map.on("mousemove", "states-fill", (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        if (e.features?.length) {
          map.setFilter("states-hover", ["==", "uf_code", e.features[0].properties.uf_code]);
        }
      });
      map.on("mouseleave", "states-fill", () => {
        map.getCanvas().style.cursor = "";
        map.setFilter("states-hover", ["==", "uf_code", ""]);
      });

      // Click
      map.on("click", "states-fill", (e: any) => {
        if (e.features?.length) {
          const ufCode = e.features[0].properties.uf_code;
          setSelectedUf(ufCode);
          setFilterUf(ufCode);
        }
      });
    }
  }, [geojson, stats, mapLoaded]);

  // Fly to UF when filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (filterUf && geojson) {
      const feature = geojson.features.find((f: any) => f.properties.uf_code === filterUf);
      if (feature) {
        // Compute bbox center
        const coords = feature.geometry.type === "Polygon"
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates.flat(1);
        const lngs = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        const center: [number, number] = [
          (Math.min(...lngs) + Math.max(...lngs)) / 2,
          (Math.min(...lats) + Math.max(...lats)) / 2,
        ];
        map.flyTo({ center, zoom: 6, duration: 1200 });
      }
    } else {
      map.fitBounds([[-73.5, -33.7], [-34.8, 5.3]], { padding: 30, duration: 1200 });
      setSelectedUf(null);
    }
  }, [filterUf, mapLoaded, geojson]);

  // Compute totals
  const totalEventos = Object.values(stats).reduce((a, s) => a + s.eventos, 0);
  const totalEmergencias = Object.values(stats).reduce((a, s) => a + s.emergencias, 0);
  const totalMonitoradas = Object.values(stats).reduce((a, s) => a + s.monitoradas, 0);

  const currentStats = selectedUf && stats[selectedUf]
    ? stats[selectedUf]
    : { eventos: totalEventos, emergencias: totalEmergencias, monitoradas: totalMonitoradas };

  const maxEventos = Math.max(1, ...Object.values(stats).map((s) => s.eventos));
  const level = getLevelLabel(currentStats.eventos, maxEventos);

  // Top UFs for ranking
  const topUfs = Object.entries(stats)
    .sort(([, a], [, b]) => b.eventos - a.eventos)
    .slice(0, 6);

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

        {/* Legend */}
        {mapLoaded && (
          <div
            className="absolute bottom-4 left-4 rounded-md border p-3"
            style={{ background: "hsl(0 0% 100% / 0.95)", borderColor: "hsl(220 13% 91%)", zIndex: 5 }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
              Eventos por UF
            </p>
            <div className="space-y-1">
              {[
                { color: "#dc2626", label: "Muito alto (15+)" },
                { color: "#f97316", label: "Alto (6-14)" },
                { color: "#facc15", label: "Moderado (3-5)" },
                { color: "#4ade80", label: "Baixo (1-2)" },
                { color: "#e5e7eb", label: "Sem dados" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded-sm" style={{ background: item.color }} />
                  <span className="text-[10px]" style={{ color: "hsl(220 9% 46%)" }}>{item.label}</span>
                </div>
              ))}
            </div>
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
            value={filterUf}
            onChange={(e) => {
              setFilterUf(e.target.value);
              setSelectedUf(e.target.value || null);
            }}
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
          {selectedUf || "Brasil"}
        </h3>
        <div className="space-y-2 text-xs" style={{ color: "hsl(220 9% 46%)" }}>
          <div className="flex justify-between">
            <span>Monitoradas ativas</span>
            <span className="font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{currentStats.monitoradas}</span>
          </div>
          <div className="flex justify-between">
            <span>Eventos no período</span>
            <span className="font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{currentStats.eventos}</span>
          </div>
          <div className="flex justify-between">
            <span>Emergências</span>
            <span className="font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{currentStats.emergencias}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Nível</span>
            <GovStatusBadge status={level.status} label={level.label} />
          </div>
        </div>

        <hr style={{ borderColor: "hsl(220 13% 91%)" }} className="my-4" />

        {/* Top UFs or Municipios */}
        {selectedUf ? (
          <>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
              Municípios — {selectedUf}
            </h3>
            {municipios.length === 0 ? (
              <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>Nenhum evento registrado</p>
            ) : (
              <div className="space-y-1">
                {municipios.map((m) => (
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
            )}
            <button
              onClick={() => { setFilterUf(""); setSelectedUf(null); }}
              className="mt-3 text-xs font-medium px-3 py-1.5 rounded border transition-colors"
              style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
            >
              ← Voltar para Brasil
            </button>
          </>
        ) : (
          <>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
              UFs com mais eventos
            </h3>
            {topUfs.length === 0 ? (
              <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>Nenhum dado no período</p>
            ) : (
              <div className="space-y-1">
                {topUfs.map(([uf, s]) => (
                  <button
                    key={uf}
                    onClick={() => { setFilterUf(uf); setSelectedUf(uf); }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-gray-50 transition-colors text-left"
                    style={{ background: "hsl(210 17% 96%)" }}
                  >
                    <span style={{ color: "hsl(220 13% 18%)" }}>{uf}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: "hsl(220 9% 46%)" }}>{s.eventos} ev.</span>
                      <div
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ background: getColorForValue(s.eventos) }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
