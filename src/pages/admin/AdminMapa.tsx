import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMapbox } from "@/hooks/useMapbox";
import { MapPin, AlertTriangle, Smartphone, Users, RefreshCw, BarChart3, Mic, Clock } from "lucide-react";
import GovKpiCard from "@/components/institucional/GovKpiCard";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
  AreaChart, Area,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const BRAZIL_GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

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

const PIE_COLORS = [
  "hsl(142 64% 34%)", "hsl(45 93% 47%)", "hsl(25 95% 53%)",
  "hsl(0 73% 42%)", "hsl(220 9% 70%)",
];

const BAR_COLORS = [
  "hsl(224 76% 48%)", "hsl(262 60% 50%)", "hsl(316 72% 48%)",
  "hsl(190 80% 42%)", "hsl(142 64% 34%)", "hsl(45 93% 47%)",
  "hsl(25 95% 53%)", "hsl(0 73% 42%)", "hsl(280 55% 40%)",
  "hsl(200 70% 50%)", "hsl(160 60% 40%)", "hsl(340 65% 47%)",
];

const RISK_LABELS: Record<string, string> = {
  baixo: "Baixo", moderado: "Moderado", alto: "Alto", critico: "Crítico", sem_risco: "Sem risco",
};

const ACIONAMENTO_LABELS: Record<string, string> = {
  app: "Aplicativo", botao_fisico: "Botão", botao_manual: "Botão", botao: "Botão", automatico: "Automático",
};

const cardStyle = { background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" };
const titleStyle = { color: "hsl(220 13% 18%)" };
const subtitleStyle = { color: "hsl(220 9% 46%)" };

// Approximate centroids for Brazilian states (fallback when no GPS)
const UF_CENTROID: Record<string, [number, number]> = {
  AC: [-8.77, -70.55], AL: [-9.57, -36.78], AP: [1.41, -51.77], AM: [-3.47, -65.10],
  BA: [-12.96, -41.70], CE: [-5.20, -39.53], DF: [-15.83, -47.86], ES: [-19.19, -40.34],
  GO: [-15.98, -49.86], MA: [-5.42, -45.44], MT: [-12.64, -55.42], MS: [-20.51, -54.54],
  MG: [-18.10, -44.38], PA: [-3.79, -52.48], PB: [-7.28, -36.72], PR: [-24.89, -51.55],
  PE: [-8.38, -37.86], PI: [-6.60, -42.28], RJ: [-22.25, -42.66], RN: [-5.81, -36.59],
  RS: [-30.17, -53.50], RO: [-10.83, -63.34], RR: [1.99, -61.33], SC: [-27.45, -50.95],
  SP: [-22.19, -48.79], SE: [-10.57, -37.45], TO: [-10.25, -48.25],
};
const tooltipStyle = {
  fontFamily: "Inter, sans-serif", fontSize: 12, borderRadius: 6,
  border: "1px solid hsl(220 13% 91%)",
};

interface AlertMarker {
  id: string; lat: number; lng: number; status: string;
  protocolo: string | null; criado_em: string; userName: string;
}

interface DeviceMarker {
  id: string; lat: number; lng: number; status: string;
  userName: string; bateria: number | null; lastPing: string | null; isMonitoring: boolean;
}

interface UfStats { usuarios: number; online: number; alertas: number; monitorando: number; }
type StatsMap = Record<string, UfStats>;

export default function AdminMapa() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const { mapboxgl: mapboxglInstance, loading: mbLoading } = useMapbox();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [geojson, setGeojson] = useState<any>(null);
  const [stats, setStats] = useState<StatsMap>({});
  const [municipioStats, setMunicipioStats] = useState<Record<string, StatsMap>>({});
  const [alerts, setAlerts] = useState<AlertMarker[]>([]);
  const [devices, setDevices] = useState<DeviceMarker[]>([]);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showDevices, setShowDevices] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");

  // Dashboard analytics state
  const [analyticsPeriod, setAnalyticsPeriod] = useState("30d");
  const [kpis, setKpis] = useState({ monitoradas: 0, eventos: 0, emergencias: 0, dispositivosOnline: 0, totalGravacoes: 0, totalHorasGravacao: 0 });
  const [timelineData, setTimelineData] = useState<{ date: string; eventos: number; emergencias: number }[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<{ name: string; value: number }[]>([]);
  const [ufData, setUfData] = useState<{ uf: string; total: number }[]>([]);
  const [acionamentoData, setAcionamentoData] = useState<{ name: string; value: number }[]>([]);
  const [hourlyData, setHourlyData] = useState<{ hora: string; alertas: number; logins: number }[]>([]);

  // Summary counts
  const totalUsuarios = Object.values(stats).reduce((a, s) => a + s.usuarios, 0);
  const totalOnline = Object.values(stats).reduce((a, s) => a + s.online, 0);
  const totalAlertas = alerts.filter((a) => a.status === "ativo").length;
  const totalMonitorando = Object.values(stats).reduce((a, s) => a + s.monitorando, 0);

  const regions = [
    { nome: "Porto Velho", eventos: 45, emergencias: 8, tendencia: "subindo" as const },
    { nome: "Ji-Paraná", eventos: 32, emergencias: 5, tendencia: "estável" as const },
    { nome: "Ariquemes", eventos: 21, emergencias: 3, tendencia: "descendo" as const },
    { nome: "Vilhena", eventos: 18, emergencias: 2, tendencia: "estável" as const },
  ];

  // Load GeoJSON
  useEffect(() => {
    fetch(BRAZIL_GEOJSON_URL)
      .then((r) => r.json())
      .then((data) => {
        data.features = data.features.map((f: any) => ({
          ...f,
          properties: { ...f.properties, uf_code: STATE_NAME_TO_UF[f.properties.name] || f.properties.name },
        }));
        setGeojson(data);
      })
      .catch(console.error);
  }, []);

  // Fetch map operational data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const periodHours = { "24h": 24, "7d": 168, "30d": 720 }[period];
    const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    const [
      { data: users }, { data: deviceData }, { data: alertData }, { data: locations },
    ] = await Promise.all([
      supabase.from("usuarios").select("id, nome_completo, endereco_uf, endereco_cidade, endereco_lat, endereco_lon, status"),
      supabase.from("device_status").select("*").order("updated_at", { ascending: false }),
      supabase.from("alertas_panico").select("*").eq("status", "ativo").order("criado_em", { ascending: false }).limit(50),
      supabase.from("localizacoes").select("user_id, latitude, longitude, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    ]);

    const userMap: Record<string, { nome: string; uf: string; cidade: string; lat: number | null; lng: number | null }> = {};
    (users || []).forEach((u) => { userMap[u.id] = { nome: u.nome_completo, uf: u.endereco_uf || "", cidade: u.endereco_cidade || "", lat: u.endereco_lat, lng: u.endereco_lon }; });

    const ufStats: StatsMap = {};
    const munStats: Record<string, StatsMap> = {};
    const ensureUf = (uf: string) => { if (!ufStats[uf]) ufStats[uf] = { usuarios: 0, online: 0, alertas: 0, monitorando: 0 }; };
    const ensureMun = (uf: string, cidade: string) => {
      if (!cidade) return;
      if (!munStats[uf]) munStats[uf] = {};
      if (!munStats[uf][cidade]) munStats[uf][cidade] = { usuarios: 0, online: 0, alertas: 0, monitorando: 0 };
    };

    (users || []).forEach((u) => {
      if (u.endereco_uf && u.status === "ativo") {
        ensureUf(u.endereco_uf); ufStats[u.endereco_uf].usuarios++;
        const cidade = u.endereco_cidade || "";
        if (cidade) { ensureMun(u.endereco_uf, cidade); munStats[u.endereco_uf][cidade].usuarios++; }
      }
    });

    const latestDeviceByUser: Record<string, any> = {};
    (deviceData || []).forEach((d) => { if (!latestDeviceByUser[d.user_id]) latestDeviceByUser[d.user_id] = d; });

    Object.values(latestDeviceByUser).forEach((d: any) => {
      const u = userMap[d.user_id];
      if (u?.uf) {
        ensureUf(u.uf);
        if (d.status === "online") ufStats[u.uf].online++;
        if (d.is_monitoring) ufStats[u.uf].monitorando++;
        if (u.cidade) {
          ensureMun(u.uf, u.cidade);
          if (d.status === "online") munStats[u.uf][u.cidade].online++;
          if (d.is_monitoring) munStats[u.uf][u.cidade].monitorando++;
        }
      }
    });

    (alertData || []).forEach((a) => {
      const u = userMap[a.user_id];
      if (u?.uf) { ensureUf(u.uf); ufStats[u.uf].alertas++; if (u.cidade) { ensureMun(u.uf, u.cidade); munStats[u.uf][u.cidade].alertas++; } }
    });
    setStats(ufStats);
    setMunicipioStats(munStats);

    const userLastLocation: Record<string, { lat: number; lng: number; created_at: string }> = {};
    (locations || []).forEach((l) => { if (!userLastLocation[l.user_id]) userLastLocation[l.user_id] = { lat: l.latitude, lng: l.longitude, created_at: l.created_at }; });

    const alertMarkers: AlertMarker[] = (alertData || []).map((a) => {
      const user = userMap[a.user_id];
      const lastLoc = userLastLocation[a.user_id];
      const ufCenter = user?.uf ? UF_CENTROID[user.uf] : null;
      const lat = a.latitude ?? user?.lat ?? lastLoc?.lat ?? ufCenter?.[0];
      const lng = a.longitude ?? user?.lng ?? lastLoc?.lng ?? ufCenter?.[1];
      if (!lat || !lng) return null;
      return {
        id: a.id, lat, lng, status: a.status,
        protocolo: a.protocolo, criado_em: a.criado_em, userName: user?.nome || "—",
      };
    }).filter(Boolean) as AlertMarker[];
    setAlerts(alertMarkers);


    // Build device markers for ALL active users (not just those with device_status)
    const deviceMarkers: DeviceMarker[] = (users || [])
      .filter((u) => u.status === "ativo")
      .map((u) => {
        const device = latestDeviceByUser[u.id];
        const loc = userLastLocation[u.id];
        const ufCenter = u.endereco_uf ? UF_CENTROID[u.endereco_uf] : null;
        const lat = loc?.lat ?? u.endereco_lat ?? ufCenter?.[0];
        const lng = loc?.lng ?? u.endereco_lon ?? ufCenter?.[1];
        if (lat == null || lng == null) return null;
        return {
          id: device?.id || u.id,
          lat, lng,
          status: device?.status || "offline",
          userName: u.nome_completo || "—",
          bateria: device?.bateria_percentual ?? null,
          lastPing: device?.last_ping_at ?? null,
          isMonitoring: device?.is_monitoring ?? false,
        };
      }).filter(Boolean) as DeviceMarker[];
    setDevices(deviceMarkers);
    setLastRefresh(new Date());
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch dashboard analytics
  useEffect(() => {
    const periodDays = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[analyticsPeriod] || 30;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    async function loadAnalytics() {
      const [
        { count: monitoradas }, { count: eventos }, { count: emergencias }, { data: deviceData },
        { data: eventosData }, { data: panicData }, { data: riskData }, { data: usersData }, { data: auditData },
        { data: gravacoesData, count: totalGravacoes },
      ] = await Promise.all([
        supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("gravacoes_analises").select("*", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("alertas_panico").select("*", { count: "exact", head: true }).gte("criado_em", since),
        supabase.from("device_status").select("status"),
        supabase.from("gravacoes_analises").select("created_at").gte("created_at", since),
        supabase.from("alertas_panico").select("criado_em, tipo_acionamento").gte("criado_em", since),
        supabase.from("gravacoes_analises").select("nivel_risco").gte("created_at", since),
        supabase.from("usuarios").select("endereco_uf, status"),
        supabase.from("audit_logs").select("action_type, success, created_at").gte("created_at", since),
        supabase.from("gravacoes").select("duracao_segundos", { count: "exact" }).gte("created_at", since),
      ]);

      const onlineCount = (deviceData || []).filter(d => d.status === "online").length;
      const totalSegundos = (gravacoesData || []).reduce((sum, g) => sum + (g.duracao_segundos || 0), 0);
      const totalHoras = Math.round((totalSegundos / 3600) * 10) / 10;
      setKpis({ monitoradas: monitoradas || 0, eventos: eventos || 0, emergencias: emergencias || 0, dispositivosOnline: onlineCount, totalGravacoes: totalGravacoes || 0, totalHorasGravacao: totalHoras });

      const buckets: Record<string, { eventos: number; emergencias: number }> = {};
      for (let i = 0; i < periodDays; i++) buckets[format(subDays(new Date(), i), "yyyy-MM-dd")] = { eventos: 0, emergencias: 0 };
      (eventosData || []).forEach(e => { const k = format(new Date(e.created_at), "yyyy-MM-dd"); if (buckets[k]) buckets[k].eventos++; });
      (panicData || []).forEach(e => { const k = format(new Date(e.criado_em), "yyyy-MM-dd"); if (buckets[k]) buckets[k].emergencias++; });
      setTimelineData(Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
        date: format(new Date(date), periodDays <= 30 ? "dd/MM" : "MM/yy", { locale: ptBR }), ...v,
      })));

      const riskCounts: Record<string, number> = {};
      (riskData || []).forEach(r => { const k = r.nivel_risco || "sem_risco"; riskCounts[k] = (riskCounts[k] || 0) + 1; });
      setRiskDistribution(Object.entries(riskCounts).map(([k, v]) => ({ name: RISK_LABELS[k] || k, value: v })));

      const ufCounts: Record<string, number> = {};
      (usersData || []).forEach(u => { const uf = u.endereco_uf || "N/I"; ufCounts[uf] = (ufCounts[uf] || 0) + 1; });
      setUfData(Object.entries(ufCounts).map(([uf, total]) => ({ uf, total })).sort((a, b) => b.total - a.total).slice(0, 12));

      const acCounts: Record<string, number> = {};
      (panicData || []).forEach(a => { const t = a.tipo_acionamento || "desconhecido"; const label = ACIONAMENTO_LABELS[t] || t; acCounts[label] = (acCounts[label] || 0) + 1; });
      setAcionamentoData(Object.entries(acCounts).map(([name, value]) => ({ name, value })));

      const hourBuckets: Record<number, { alertas: number; logins: number }> = {};
      for (let h = 0; h < 24; h++) hourBuckets[h] = { alertas: 0, logins: 0 };
      (panicData || []).forEach(a => { const h = new Date(a.criado_em).getHours(); hourBuckets[h].alertas++; });
      (auditData || []).filter(a => a.action_type === "login" && a.success).forEach(a => { const h = new Date(a.created_at).getHours(); hourBuckets[h].logins++; });
      setHourlyData(Object.entries(hourBuckets).map(([h, v]) => ({ hora: `${h.padStart(2, "0")}h`, ...v })));
    }

    loadAnalytics();
  }, [analyticsPeriod]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !mapboxglInstance) return;
    const map = new mapboxglInstance.Map({
      container: mapContainer.current,
      style: {
        version: 8, name: "Admin Clean",
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sources: { "simple-tiles": { type: "raster", tiles: ["https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png", "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png"], tileSize: 256 } },
        layers: [{ id: "simple-tiles-layer", type: "raster", source: "simple-tiles", minzoom: 0, maxzoom: 22 }],
      },
      center: [-52, -15], zoom: 3.2, maxBounds: [[-75, -35], [-28, 6]], minZoom: 2.8,
    });
    map.once("load", () => { map.fitBounds([[-73.5, -33.7], [-34.8, 5.3]], { padding: 30, duration: 0 }); });
    map.addControl(new mapboxglInstance.NavigationControl(), "top-right");
    map.on("load", () => setMapLoaded(true));
    mapRef.current = map;
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, [mapboxglInstance]);

  // Choropleth layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geojson) return;
    const enriched = {
      ...geojson,
      features: geojson.features.map((f: any) => {
        const uf = f.properties.uf_code;
        const s = stats[uf] || { usuarios: 0, online: 0, alertas: 0, monitorando: 0 };
        return { ...f, properties: { ...f.properties, usuarios: s.usuarios, online: s.online, alertas: s.alertas, monitorando: s.monitorando } };
      }),
    };
    if (map.getSource("states")) {
      (map.getSource("states") as any).setData(enriched);
    } else {
      map.addSource("states", { type: "geojson", data: enriched });
      map.addLayer({ id: "states-fill", type: "fill", source: "states", paint: { "fill-color": ["step", ["get", "usuarios"], "#e5e7eb", 1, "#bfdbfe", 5, "#93c5fd", 10, "#60a5fa", 20, "#3b82f6"], "fill-opacity": 0.6 } });
      map.addLayer({ id: "states-outline", type: "line", source: "states", paint: { "line-color": "hsl(220, 13%, 70%)", "line-width": 1 } });
      map.addLayer({ id: "states-hover", type: "fill", source: "states", paint: { "fill-color": "hsl(224, 76%, 33%)", "fill-opacity": 0.15 }, filter: ["==", "uf_code", ""] });

      const labelFeatures = enriched.features.map((f: any) => {
        const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
        const lngs = coords.map((c: number[]) => c[0]); const lats = coords.map((c: number[]) => c[1]);
        return { type: "Feature", geometry: { type: "Point", coordinates: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] }, properties: { uf_code: f.properties.uf_code, usuarios: f.properties.usuarios || 0 } };
      });
      map.addSource("state-labels", { type: "geojson", data: { type: "FeatureCollection", features: labelFeatures } });
      map.addLayer({ id: "state-labels-layer", type: "symbol", source: "state-labels", layout: { "text-field": ["case", [">", ["get", "usuarios"], 0], ["concat", ["get", "uf_code"], " (", ["to-string", ["get", "usuarios"]], ")"], ["get", "uf_code"]], "text-size": 11, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": false, "text-anchor": "center" }, paint: { "text-color": "hsl(220, 13%, 25%)", "text-halo-color": "hsl(0, 0%, 100%)", "text-halo-width": 1.5 } });

      const mbgl = mapboxglInstance;
      if (!mbgl) return;
      const popup = new mbgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "240px" });
      map.on("mousemove", "states-fill", (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        if (e.features?.length) {
          const p = e.features[0].properties;
          map.setFilter("states-hover", ["==", "uf_code", p.uf_code]);
          const stateName = UF_TO_STATE_NAME[p.uf_code] || p.uf_code;
          popup.setLngLat(e.lngLat).setHTML(`<div style="font-family:Inter,Roboto,sans-serif;font-size:11px;line-height:1.6;color:hsl(220,13%,18%)"><strong style="font-size:13px">${stateName}</strong><div style="margin-top:4px;display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Usuárias ativas</span><strong>${p.usuarios || 0}</strong></div><div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Dispositivos online</span><strong style="color:hsl(142,71%,35%)">${p.online || 0}</strong></div><div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Monitorando</span><strong style="color:hsl(224,76%,33%)">${p.monitorando || 0}</strong></div><div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Alertas ativos</span><strong style="color:hsl(0,72%,51%)">${p.alertas || 0}</strong></div></div>`).addTo(map);
        }
      });
      map.on("mouseleave", "states-fill", () => { map.getCanvas().style.cursor = ""; map.setFilter("states-hover", ["==", "uf_code", ""]); popup.remove(); });
      map.on("click", "states-fill", (e: any) => { if (e.features?.length) { const uf = e.features[0].properties.uf_code; setSelectedUf((prev) => (prev === uf ? null : uf)); } });
    }
  }, [geojson, stats, mapLoaded]);

  // Update labels when stats change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geojson || !map.getSource("state-labels")) return;
    const labelFeatures = geojson.features.map((f: any) => {
      const uf = f.properties.uf_code; const s = stats[uf] || { usuarios: 0 };
      const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
      const lngs = coords.map((c: number[]) => c[0]); const lats = coords.map((c: number[]) => c[1]);
      return { type: "Feature", geometry: { type: "Point", coordinates: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] }, properties: { uf_code: uf, usuarios: s.usuarios || 0 } };
    });
    (map.getSource("state-labels") as any).setData({ type: "FeatureCollection", features: labelFeatures });
  }, [stats, mapLoaded, geojson]);

  // Markers
  useEffect(() => {
    const map = mapRef.current; const mbgl = mapboxglInstance;
    if (!map || !mbgl || !mapLoaded) return;
    markersRef.current.forEach((m) => m.remove()); markersRef.current = [];

    if (showAlerts) {
      alerts.forEach((a) => {
        const el = document.createElement("div");
        el.style.cssText = "width:28px;height:28px;border-radius:50%;background:hsl(0,72%,51%);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite";
        el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        const popup = new mbgl.Popup({ offset: 15, maxWidth: "220px" }).setHTML(`<div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.5"><strong style="color:hsl(0,72%,51%)">⚠ Alerta Ativo</strong><div style="margin-top:4px"><span style="color:hsl(220,9%,46%)">Usuária:</span> ${a.userName}</div>${a.protocolo ? `<div><span style="color:hsl(220,9%,46%)">Protocolo:</span> ${a.protocolo}</div>` : ""}<div><span style="color:hsl(220,9%,46%)">Horário:</span> ${new Date(a.criado_em).toLocaleString("pt-BR")}</div></div>`);
        const marker = new mbgl.Marker({ element: el }).setLngLat([a.lng, a.lat]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
      });
    }

    if (showDevices) {
      devices.forEach((d) => {
        const isOnline = d.status === "online";
        const el = document.createElement("div");
        el.style.cssText = `width:8px;height:8px;border-radius:50%;background:${isOnline ? "hsl(142,71%,35%)" : "hsl(220,9%,60%)"};border:1px solid white;box-shadow:0 0 2px rgba(0,0,0,0.15);cursor:pointer`;
        const popup = new mbgl.Popup({ offset: 12, maxWidth: "220px" }).setHTML(`<div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.5"><strong>${d.userName}</strong><div style="margin-top:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isOnline ? "hsl(142,71%,35%)" : "hsl(220,9%,60%)"};margin-right:4px"></span>${isOnline ? "Online" : "Offline"}${d.isMonitoring ? ' · <span style="color:hsl(224,76%,33%)">Monitorando</span>' : ""}</div>${d.bateria != null ? `<div><span style="color:hsl(220,9%,46%)">Bateria:</span> ${d.bateria}%</div>` : ""}${d.lastPing ? `<div><span style="color:hsl(220,9%,46%)">Último ping:</span> ${new Date(d.lastPing).toLocaleString("pt-BR")}</div>` : ""}</div>`);
        const marker = new mbgl.Marker({ element: el }).setLngLat([d.lng, d.lat]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
      });
    }
  }, [alerts, devices, showAlerts, showDevices, mapLoaded, mapboxglInstance]);

  // Fly to UF
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geojson) return;
    if (selectedUf) {
      const feature = geojson.features.find((f: any) => f.properties.uf_code === selectedUf);
      if (feature) {
        const coords = feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0] : feature.geometry.coordinates.flat(2);
        const lngs = coords.map((c: number[]) => c[0]); const lats = coords.map((c: number[]) => c[1]);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, duration: 1200 });
      }
    } else {
      map.fitBounds([[-73.5, -33.7], [-34.8, 5.3]], { padding: 30, duration: 1200 });
    }
  }, [selectedUf, mapLoaded, geojson]);

  const topUfs = Object.entries(stats).filter(([, s]) => s.usuarios > 0).sort(([, a], [, b]) => b.online - a.online).slice(0, 8);

  return (
    <div style={fontStyle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs mb-0.5" style={subtitleStyle}>Admin &gt; Dashboard</p>
          <h1 className="text-xl font-semibold" style={titleStyle}>Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {([["24h", "24h"], ["7d", "7 dias"], ["30d", "30 dias"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setPeriod(key)}
                className="px-3 py-1.5 text-xs rounded-md border transition-colors"
                style={{ borderColor: period === key ? "hsl(224 76% 33%)" : "hsl(220 13% 91%)", background: period === key ? "hsl(224 76% 33%)" : "transparent", color: period === key ? "#fff" : "hsl(220 9% 46%)", fontWeight: period === key ? 600 : 400 }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { icon: Users, label: "Usuárias Ativas", value: totalUsuarios, color: "hsl(224 76% 33%)", bg: "hsl(224 76% 33% / 0.08)" },
          { icon: Smartphone, label: "Dispositivos Online", value: totalOnline, color: "hsl(142 71% 35%)", bg: "hsl(142 71% 35% / 0.08)" },
          { icon: MapPin, label: "Monitorando Agora", value: totalMonitorando, color: "hsl(262 83% 58%)", bg: "hsl(262 83% 58% / 0.08)" },
          { icon: AlertTriangle, label: "Alertas Ativos", value: totalAlertas, color: "hsl(0 72% 51%)", bg: "hsl(0 72% 51% / 0.08)" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="rounded-lg border p-3 flex items-center gap-3" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-lg font-bold leading-none" style={{ color }}>{value}</p>
              <p className="text-[10px] mt-0.5" style={subtitleStyle}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Map + sidebar */}
      <div className="flex flex-col md:flex-row rounded-lg border overflow-hidden" style={{ borderColor: "hsl(220 13% 91%)", height: "calc(100vh - 290px)", minHeight: "400px" }}>
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full min-h-[400px]" />
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(210 17% 96%)" }}>
              <p className="text-sm" style={subtitleStyle}>Carregando mapa…</p>
            </div>
          )}
          <div className="absolute bottom-3 left-3 rounded-lg border p-3" style={{ background: "hsl(0 0% 100% / 0.95)", borderColor: "hsl(220 13% 91%)", backdropFilter: "blur(8px)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={subtitleStyle}>Legenda</p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showAlerts} onChange={(e) => setShowAlerts(e.target.checked)} className="rounded" />
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "hsl(0,72%,51%)" }} />
                <span className="text-[11px]" style={titleStyle}>Alertas ativos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showDevices} onChange={(e) => setShowDevices(e.target.checked)} className="rounded" />
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "hsl(142,71%,35%)" }} />
                <span className="text-[11px]" style={titleStyle}>Dispositivos online</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "hsl(220,9%,60%)" }} />
                <span className="text-[11px]" style={titleStyle}>Dispositivos offline</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-72 border-t md:border-t-0 md:border-l overflow-y-auto p-4" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
          {selectedUf ? (
            <>
              <h3 className="text-sm font-bold mb-3" style={titleStyle}>{UF_TO_STATE_NAME[selectedUf] || selectedUf} — {selectedUf}</h3>
              {stats[selectedUf] ? (
                <div className="space-y-2 mb-4">
                  {[
                    { label: "Usuárias ativas", value: stats[selectedUf].usuarios, color: "hsl(224 76% 33%)" },
                    { label: "Online", value: stats[selectedUf].online, color: "hsl(142 71% 35%)" },
                    { label: "Monitorando", value: stats[selectedUf].monitorando, color: "hsl(262 83% 58%)" },
                    { label: "Alertas ativos", value: stats[selectedUf].alertas, color: "hsl(0 72% 51%)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ background: "hsl(210 17% 96%)" }}>
                      <span className="text-xs" style={subtitleStyle}>{label}</span>
                      <span className="text-sm font-bold" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs py-3 text-center rounded-lg mb-4" style={{ ...subtitleStyle, background: "hsl(210 17% 96%)" }}>Sem dados para este estado</p>
               )}
              {/* Ranking por município */}
              {selectedUf && municipioStats[selectedUf] && Object.keys(municipioStats[selectedUf]).length > 0 && (
                <>
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mt-4 mb-2" style={subtitleStyle}>Ranking por Município</h4>
                  <div className="space-y-1">
                    {Object.entries(municipioStats[selectedUf])
                      .sort((a, b) => b[1].usuarios - a[1].usuarios)
                      .map(([cidade, s]) => (
                        <div key={cidade} className="flex items-center justify-between px-2 py-2 rounded-lg text-xs" style={{ background: "hsl(210 17% 96%)" }}>
                          <span className="font-medium truncate mr-2" style={titleStyle}>{cidade}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span style={{ color: "hsl(224 76% 33%)" }}>{s.usuarios}</span>
                            <span style={{ color: "hsl(142 71% 35%)" }}>{s.online} on</span>
                            {s.alertas > 0 && <span className="font-bold" style={{ color: "hsl(0 72% 51%)" }}>{s.alertas} ⚠</span>}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
              <button onClick={() => setSelectedUf(null)} className="w-full text-xs font-medium px-3 py-2 rounded-lg border transition-colors hover:bg-gray-50 mt-4" style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}>← Voltar para Brasil</button>
            </>
          ) : (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={subtitleStyle}>Ranking por UF</h3>
              {topUfs.length === 0 ? (
                <p className="text-xs py-3 text-center rounded-lg" style={{ ...subtitleStyle, background: "hsl(210 17% 96%)" }}>Nenhum dado disponível</p>
              ) : (
                <div className="space-y-1">
                  {topUfs.map(([uf, s]) => (
                    <button key={uf} onClick={() => setSelectedUf(uf)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs hover:bg-gray-50 transition-colors text-left" style={{ background: "hsl(210 17% 96%)" }}>
                      <span className="font-medium" style={titleStyle}>{UF_TO_STATE_NAME[uf] || uf}</span>
                      <div className="flex items-center gap-3">
                        <span style={{ color: "hsl(142 71% 35%)" }}>{s.online} on</span>
                        {s.alertas > 0 && <span className="font-bold" style={{ color: "hsl(0 72% 51%)" }}>{s.alertas} ⚠</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid hsl(220 13% 91%)" }}>
            <p className="text-[10px] text-center" style={{ color: "hsl(220 9% 60%)" }}>Atualizado em {lastRefresh.toLocaleTimeString("pt-BR")}</p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* Analytics Section (migrated from Dashboard) */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-lg font-semibold" style={titleStyle}>Análise de Dados</h2>
          <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border" style={cardStyle}>
            <span className="text-xs font-medium" style={subtitleStyle}>Período:</span>
            {["7d", "30d", "90d", "12m"].map((p) => (
              <button key={p} onClick={() => setAnalyticsPeriod(p)}
                className="px-3 py-1 text-xs rounded border transition-colors"
                style={{ borderColor: analyticsPeriod === p ? "hsl(224 76% 33%)" : "hsl(220 13% 91%)", background: analyticsPeriod === p ? "hsl(224 76% 33%)" : "transparent", color: analyticsPeriod === p ? "#fff" : "hsl(220 9% 46%)", fontWeight: analyticsPeriod === p ? 600 : 400 }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <GovKpiCard title="Monitoradas Ativas" value={kpis.monitoradas} icon={Users} />
          <GovKpiCard title="Eventos no Período" value={kpis.eventos} icon={BarChart3} />
          <GovKpiCard title="Emergências" value={kpis.emergencias} icon={AlertTriangle} />
          <GovKpiCard title="Dispositivos Online" value={kpis.dispositivosOnline} icon={Smartphone} />
          <GovKpiCard title="Gravações" value={kpis.totalGravacoes} icon={Mic} subtitle="no período" />
          <GovKpiCard title="Tempo de Áudio" value={`${kpis.totalHorasGravacao}h`} icon={Clock} subtitle="total gravado" />
        </div>

        {/* Timeline + Risk Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 rounded-md border p-4" style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4" style={titleStyle}>Evolução Temporal — Eventos e Emergências</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} interval={timelineData.length > 60 ? Math.floor(timelineData.length / 12) : "preserveStartEnd"} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="eventos" name="Eventos" stroke="hsl(224 76% 48%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="emergencias" name="Emergências" stroke="hsl(0 73% 42%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {timelineData.length === 0 && <p className="text-center text-xs mt-2" style={subtitleStyle}>Nenhum dado no período selecionado</p>}
          </div>

          <div className="rounded-md border p-4" style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4" style={titleStyle}>Distribuição por Nível de Risco</h2>
            <div className="h-64">
              {riskDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={riskDistribution} cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                      {riskDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Inter, sans-serif" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center"><p className="text-xs" style={subtitleStyle}>Nenhum dado no período</p></div>
              )}
            </div>
          </div>
        </div>

        {/* Alert Type */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-md border p-4" style={cardStyle}>
            <h2 className="text-sm font-semibold mb-4" style={titleStyle}>Alertas por Tipo de Acionamento</h2>
            <div className="h-64">
              {acionamentoData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={acionamentoData} cx="50%" cy="45%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                      {acionamentoData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Inter, sans-serif" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center"><p className="text-xs" style={subtitleStyle}>Nenhum alerta no período</p></div>
              )}
            </div>
          </div>
        </div>

        {/* Hourly Activity */}
        <div className="rounded-md border p-4 mb-6" style={cardStyle}>
          <h2 className="text-sm font-semibold mb-1" style={titleStyle}>Atividade por Hora do Dia</h2>
          <p className="text-xs mb-4" style={subtitleStyle}>Picos de alertas e acessos ao sistema</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="alertas" name="Alertas" stroke="hsl(0 73% 42%)" fill="hsl(0 73% 42% / 0.15)" strokeWidth={2} />
                <Area type="monotone" dataKey="logins" name="Logins" stroke="hsl(224 76% 48%)" fill="hsl(224 76% 48% / 0.15)" strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Inter, sans-serif" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regions Table */}
        <div className="rounded-md border overflow-hidden mb-6" style={cardStyle}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "hsl(220 13% 91%)" }}>
            <h2 className="text-sm font-semibold" style={titleStyle}>Regiões com maior incidência</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "hsl(210 17% 96%)" }}>
                  {["Região", "Total Eventos", "Emergências", "Tendência", "Ação"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold" style={subtitleStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regions.map(r => (
                  <tr key={r.nome} className="border-t" style={{ borderColor: "hsl(220 13% 91%)" }}>
                    <td className="px-4 py-3 font-medium" style={titleStyle}>{r.nome}</td>
                    <td className="px-4 py-3" style={titleStyle}>{r.eventos}</td>
                    <td className="px-4 py-3" style={titleStyle}>{r.emergencias}</td>
                    <td className="px-4 py-3">
                      <GovStatusBadge status={r.tendencia === "subindo" ? "vermelho" : r.tendencia === "descendo" ? "verde" : "amarelo"}
                        label={r.tendencia.charAt(0).toUpperCase() + r.tendencia.slice(1)} />
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs font-medium px-3 py-1 rounded border transition-colors hover:bg-gray-50"
                        style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}>Detalhar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t text-xs" style={{ borderColor: "hsl(220 13% 91%)", ...subtitleStyle }}>
            Dados agregados. Visualizações detalhadas são auditadas.
          </div>
        </div>

        {/* Users by UF */}
        <div className="rounded-md border p-4" style={cardStyle}>
          <h2 className="text-sm font-semibold mb-4" style={titleStyle}>Usuárias por Estado (UF)</h2>
          <div className="h-64">
            {ufData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ufData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="uf" tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="total" name="Usuárias" radius={[4, 4, 0, 0]}>
                    {ufData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center"><p className="text-xs" style={subtitleStyle}>Nenhum dado</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
