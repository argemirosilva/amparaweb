import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";
import { useMapbox } from "@/hooks/useMapbox";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const BRAZIL_GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

interface UfStats {
  eventos: number;
  emergencias: number;
  monitoradas: number;
  baixo: number;
  medio: number;
  alto: number;
  critico: number;
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

const UF_TO_STATE_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_TO_UF).map(([name, uf]) => [uf, name])
);

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
  const { mapboxgl: mapboxglInstance, loading: mbLoading } = useMapbox();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [period, setPeriod] = useState("90d");
  const [filterUf, setFilterUf] = useState("");
  const [stats, setStats] = useState<StatsMap>({});
  const [geojson, setGeojson] = useState<any>(null);
  const [municipios, setMunicipios] = useState<{ nome: string; eventos: number }[]>([]);
  const [ufTrends, setUfTrends] = useState<Record<string, "up" | "down" | "stable">>({});

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
        supabase.from("gravacoes_analises").select("user_id, created_at, nivel_risco").gte("created_at", since),
        supabase.from("alertas_panico").select("user_id, criado_em").gte("criado_em", since),
      ]);

      const emptyStats = (): UfStats => ({ eventos: 0, emergencias: 0, monitoradas: 0, baixo: 0, medio: 0, alto: 0, critico: 0 });

      const statsMap: StatsMap = {};
      // Init all UFs
      ufSet.forEach((uf) => {
        statsMap[uf] = emptyStats();
      });

      // Count active users per UF
      (users || []).forEach((u) => {
        if (u.endereco_uf && u.status === "ativo") {
          if (!statsMap[u.endereco_uf]) statsMap[u.endereco_uf] = emptyStats();
          statsMap[u.endereco_uf].monitoradas++;
        }
      });

      // Count events per UF with severity
      (eventos || []).forEach((e: any) => {
        const uf = userUfMap[e.user_id];
        if (uf && statsMap[uf]) {
          statsMap[uf].eventos++;
          const nivel = e.nivel_risco as string;
          if (nivel === 'baixo') statsMap[uf].baixo++;
          else if (nivel === 'medio') statsMap[uf].medio++;
          else if (nivel === 'alto') statsMap[uf].alto++;
          else if (nivel === 'critico') statsMap[uf].critico++;
        }
      });

      // Count emergencies per UF
      (emergencias || []).forEach((e) => {
        const uf = userUfMap[e.user_id];
        if (uf && statsMap[uf]) statsMap[uf].emergencias++;
      });

      setStats(statsMap);

      // Compute UF trends: compare first half vs second half of period
      const midpoint = new Date(Date.now() - (periodDays / 2) * 24 * 60 * 60 * 1000).toISOString();
      const recentByUf: Record<string, number> = {};
      const olderByUf: Record<string, number> = {};
      (eventos || []).forEach((e: any) => {
        const uf = userUfMap[e.user_id];
        if (!uf) return;
        if (e.created_at >= midpoint) recentByUf[uf] = (recentByUf[uf] || 0) + 1;
        else olderByUf[uf] = (olderByUf[uf] || 0) + 1;
      });
      const trends: Record<string, "up" | "down" | "stable"> = {};
      const allUfs = new Set([...Object.keys(recentByUf), ...Object.keys(olderByUf)]);
      allUfs.forEach((uf) => {
        const r = recentByUf[uf] || 0;
        const o = olderByUf[uf] || 0;
        if (r + o < 2) { trends[uf] = "stable"; return; }
        if (o === 0) { trends[uf] = r > 0 ? "up" : "stable"; return; }
        const ratio = (r - o) / o;
        trends[uf] = ratio >= 0.2 ? "up" : ratio <= -0.2 ? "down" : "stable";
      });
      setUfTrends(trends);
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
    if (!mapContainer.current || mapRef.current || !mapboxglInstance) return;

    const brazilBounds: [[number, number], [number, number]] = [
      [-75, -35],
      [-28, 6],
    ];

    const map = new mapboxglInstance.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        name: "Brazil Clean",
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
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
          { id: "simple-tiles-layer", type: "raster", source: "simple-tiles", minzoom: 0, maxzoom: 22 },
        ],
      },
      center: [-52, -15],
      zoom: 3.2,
      maxBounds: brazilBounds,
      minZoom: 2.8,
      fitBoundsOptions: { padding: 40 },
    });

    map.once("load", () => {
      map.fitBounds([[-73.5, -33.7], [-34.8, 5.3]], { padding: 30, duration: 0 });
    });

    map.addControl(new mapboxglInstance.NavigationControl(), "top-right");
    map.on("load", () => { setMapLoaded(true); });
    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxglInstance]);

  // Update choropleth when data or geojson changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geojson) return;

    const maxEventos = Math.max(1, ...Object.values(stats).map((s) => s.eventos));
    const totalEventosAll = Object.values(stats).reduce((a, s) => a + s.eventos, 0);

    // Enrich geojson with stats
    const enriched = {
      ...geojson,
      features: geojson.features.map((f: any) => {
        const uf = f.properties.uf_code;
        const s = stats[uf] || { eventos: 0, emergencias: 0, monitoradas: 0, baixo: 0, medio: 0, alto: 0, critico: 0 };
        const pctPais = totalEventosAll > 0 ? Math.round((s.eventos / totalEventosAll) * 100) : 0;
        return {
          ...f,
          properties: {
            ...f.properties,
            eventos: s.eventos,
            emergencias: s.emergencias,
            monitoradas: s.monitoradas,
            baixo: s.baixo,
            medio: s.medio,
            alto: s.alto,
            critico: s.critico,
            pct_pais: pctPais,
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
              : f.geometry.coordinates.flat(2);
          const lngs = coords.map((c: number[]) => c[0]);
          const lats = coords.map((c: number[]) => c[1]);
          const center = [
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
            (Math.min(...lats) + Math.max(...lats)) / 2,
          ];
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: center },
            properties: { uf_code: f.properties.uf_code, state_name: UF_TO_STATE_NAME[f.properties.uf_code] || f.properties.name || "", eventos: f.properties.eventos || 0, trend: ufTrends[f.properties.uf_code] || "stable" },
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
            : f.geometry.coordinates.flat(2);
        const lngs = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        const center = [
          (Math.min(...lngs) + Math.max(...lngs)) / 2,
          (Math.min(...lats) + Math.max(...lats)) / 2,
        ];
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: center },
          properties: { uf_code: f.properties.uf_code, state_name: UF_TO_STATE_NAME[f.properties.uf_code] || f.properties.name || "", eventos: f.properties.eventos || 0, trend: ufTrends[f.properties.uf_code] || "stable" },
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
          "text-field": [
            "case",
            [">", ["get", "eventos"], 0],
            ["concat", ["get", "uf_code"], " (", ["to-string", ["get", "eventos"]], ")"],
            ["get", "uf_code"],
          ],
          "text-size": 11,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-anchor": "center",
          "text-justify": "center",
        },
        paint: {
          "text-color": "hsl(220, 13%, 25%)",
          "text-halo-color": "hsl(0, 0%, 100%)",
          "text-halo-width": 1.5,
        },
      });

      // Trend arrows layer
      map.addLayer({
        id: "state-trend-layer", type: "symbol", source: "state-labels",
        filter: ["!=", ["get", "trend"], "stable"],
        layout: {
          "text-field": ["case", ["==", ["get", "trend"], "up"], "▲", ["==", ["get", "trend"], "down"], "▼", ""],
          "text-size": 12, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 1.2], "text-allow-overlap": true, "text-ignore-placement": true,
        },
        paint: {
          "text-color": ["case", ["==", ["get", "trend"], "up"], "#dc2626", "#16a34a"],
          "text-halo-color": "hsl(0, 0%, 100%)", "text-halo-width": 1.5,
        },
      });

      // Tooltip popup
      if (!mapboxglInstance) return;
      const popup = new mapboxglInstance.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "state-tooltip",
        maxWidth: "280px",
      });

      // Hover effect
      map.on("mousemove", "states-fill", (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        if (e.features?.length) {
          const props = e.features[0].properties;
          const uf = props.uf_code;
          map.setFilter("states-hover", ["==", "uf_code", uf]);

          const total = Number(props.eventos) || 0;
          const baixo = Number(props.baixo) || 0;
          const medio = Number(props.medio) || 0;
          const alto = Number(props.alto) || 0;
          const critico = Number(props.critico) || 0;
          const pctPais = Number(props.pct_pais) || 0;

          const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0;

          const stateName = UF_TO_STATE_NAME[uf] || uf;

          const html = `
            <div style="font-family:Inter,Roboto,sans-serif;font-size:11px;line-height:1.5;color:hsl(220,13%,18%)">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
                <strong style="font-size:13px">${stateName}</strong>
                <span style="font-size:10px;color:hsl(220,9%,46%);margin-left:8px">${pctPais}% do país</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="color:hsl(220,9%,46%)">Total de eventos</span>
                <strong>${total}</strong>
              </div>
              <div style="margin:6px 0 4px;border-top:1px solid hsl(220,13%,91%);padding-top:6px">
                <span style="color:hsl(220,9%,46%);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Gravidade</span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#4ade80;margin-right:4px"></span>Baixo</span>
                <span>${baixo} <span style="color:hsl(220,9%,46%)">(${pct(baixo)}%)</span></span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#facc15;margin-right:4px"></span>Médio</span>
                <span>${medio} <span style="color:hsl(220,9%,46%)">(${pct(medio)}%)</span></span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#f97316;margin-right:4px"></span>Alto</span>
                <span>${alto} <span style="color:hsl(220,9%,46%)">(${pct(alto)}%)</span></span>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#dc2626;margin-right:4px"></span>Crítico</span>
                <span>${critico} <span style="color:hsl(220,9%,46%)">(${pct(critico)}%)</span></span>
              </div>
              <div style="margin-top:6px;border-top:1px solid hsl(220,13%,91%);padding-top:4px;display:flex;justify-content:space-between">
                <span style="color:hsl(220,9%,46%)">Emergências</span>
                <strong style="color:hsl(0,72%,51%)">${props.emergencias || 0}</strong>
              </div>
            </div>
          `;
          popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        }
      });
      map.on("mouseleave", "states-fill", () => {
        map.getCanvas().style.cursor = "";
        map.setFilter("states-hover", ["==", "uf_code", ""]);
        popup.remove();
      });

      // Click
      map.on("click", "states-fill", (e: any) => {
        if (e.features?.length) {
          const ufCode = e.features[0].properties.uf_code;
          setSelectedUf((prev) => {
            if (prev === ufCode) {
              setFilterUf("");
              return null;
            }
            setFilterUf(ufCode);
            return ufCode;
          });
        }
      });
    }
  }, [geojson, stats, ufTrends, mapLoaded]);

  // Fly to UF when filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (filterUf && geojson) {
      const feature = geojson.features.find((f: any) => f.properties.uf_code === filterUf);
      if (feature) {
        const coords = feature.geometry.type === "Polygon"
          ? feature.geometry.coordinates[0]
          : feature.geometry.coordinates.flat(2);
        const lngs = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
        const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
        map.fitBounds([sw, ne], { padding: 60, duration: 1200 });
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
    : { eventos: totalEventos, emergencias: totalEmergencias, monitoradas: totalMonitoradas, baixo: 0, medio: 0, alto: 0, critico: 0 };

  // When viewing a specific UF, compute severity from stats
  const ufSeverity = selectedUf && stats[selectedUf] ? stats[selectedUf] : null;

  const maxEventos = Math.max(1, ...Object.values(stats).map((s) => s.eventos));
  const level = getLevelLabel(currentStats.eventos, maxEventos);

  // National representation %
  const pctPais = selectedUf && totalEventos > 0
    ? Math.round((currentStats.eventos / totalEventos) * 100)
    : 100;

  // Top UFs for ranking
  const topUfs = Object.entries(stats)
    .sort(([, a], [, b]) => b.eventos - a.eventos)
    .slice(0, 6);

  // Severity bar helper
  const SeverityBar = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
        <span className="text-xs flex-1" style={{ color: "hsl(220 9% 46%)" }}>{label}</span>
        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(220 13% 93%)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="text-xs font-semibold w-8 text-right" style={{ color: "hsl(220 13% 18%)" }}>{value}</span>
        <span className="text-[10px] w-8 text-right" style={{ color: "hsl(220 9% 46%)" }}>{pct}%</span>
      </div>
    );
  };

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

        {/* Region header */}
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: "hsl(220 13% 18%)" }}>
            {selectedUf ? `${UF_TO_STATE_NAME[selectedUf] || selectedUf} — ${selectedUf}` : "Brasil"}
          </h3>
          {selectedUf && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "hsl(224 76% 33% / 0.1)", color: "hsl(224 76% 33%)" }}>
              {pctPais}% do país
            </span>
          )}
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg p-2.5 text-center" style={{ background: "hsl(210 17% 96%)" }}>
            <p className="text-lg font-bold" style={{ color: "hsl(224 76% 33%)" }}>{currentStats.monitoradas}</p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: "hsl(220 9% 46%)" }}>Monitoradas</p>
          </div>
          <div className="rounded-lg p-2.5 text-center" style={{ background: "hsl(210 17% 96%)" }}>
            <p className="text-lg font-bold" style={{ color: "hsl(220 13% 18%)" }}>{currentStats.eventos}</p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: "hsl(220 9% 46%)" }}>Eventos</p>
          </div>
          <div className="rounded-lg p-2.5 text-center" style={{ background: "hsl(0 72% 51% / 0.06)" }}>
            <p className="text-lg font-bold" style={{ color: "hsl(0 72% 51%)" }}>{currentStats.emergencias}</p>
            <p className="text-[10px] leading-tight mt-0.5" style={{ color: "hsl(220 9% 46%)" }}>Emergências</p>
          </div>
        </div>

        {/* Level badge */}
        <div className="flex items-center justify-between mb-4 px-2 py-2 rounded-lg" style={{ background: "hsl(210 17% 96%)" }}>
          <span className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>Nível de risco</span>
          <GovStatusBadge status={level.status} label={level.label} />
        </div>

        {/* Severity breakdown — only when state selected and has events */}
        {selectedUf && ufSeverity && (ufSeverity.baixo + ufSeverity.medio + ufSeverity.alto + ufSeverity.critico) > 0 && (
          <>
            <div className="mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "hsl(220 9% 46%)" }}>
                Distribuição de gravidade
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <SeverityBar label="Crítico" value={ufSeverity.critico} total={ufSeverity.eventos} color="#dc2626" />
              <SeverityBar label="Alto" value={ufSeverity.alto} total={ufSeverity.eventos} color="#f97316" />
              <SeverityBar label="Médio" value={ufSeverity.medio} total={ufSeverity.eventos} color="#facc15" />
              <SeverityBar label="Baixo" value={ufSeverity.baixo} total={ufSeverity.eventos} color="#4ade80" />
            </div>
          </>
        )}

        <hr style={{ borderColor: "hsl(220 13% 91%)" }} className="my-4" />

        {/* Top UFs or Municipios */}
        {selectedUf ? (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(220 9% 46%)" }}>
              Municípios — {selectedUf}
            </h3>
            {municipios.length === 0 ? (
              <p className="text-xs py-3 text-center rounded-lg" style={{ color: "hsl(220 9% 46%)", background: "hsl(210 17% 96%)" }}>
                Nenhum evento registrado
              </p>
            ) : (
              <div className="space-y-1">
                {municipios.map((m, i) => (
                  <div
                    key={m.nome}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{ background: "hsl(210 17% 96%)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "hsl(224 76% 33% / 0.1)", color: "hsl(224 76% 33%)" }}>
                        {i + 1}
                      </span>
                      <span style={{ color: "hsl(220 13% 18%)" }}>{m.nome}</span>
                    </div>
                    <span className="font-semibold" style={{ color: "hsl(224 76% 33%)" }}>{m.eventos}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => { setFilterUf(""); setSelectedUf(null); }}
              className="mt-4 w-full text-xs font-medium px-3 py-2 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
            >
              ← Voltar para Brasil
            </button>
          </>
        ) : (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(220 9% 46%)" }}>
              UFs com mais eventos
            </h3>
            {topUfs.length === 0 ? (
              <p className="text-xs py-3 text-center rounded-lg" style={{ color: "hsl(220 9% 46%)", background: "hsl(210 17% 96%)" }}>
                Nenhum dado no período
              </p>
            ) : (
              <div className="space-y-1">
                {topUfs.map(([uf, s]) => (
                  <button
                    key={uf}
                    onClick={() => { setFilterUf(uf); setSelectedUf(uf); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-gray-50 transition-colors text-left"
                    style={{ background: "hsl(210 17% 96%)" }}
                  >
                    <span className="font-medium" style={{ color: "hsl(220 13% 18%)" }}>{UF_TO_STATE_NAME[uf] || uf}</span>
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
