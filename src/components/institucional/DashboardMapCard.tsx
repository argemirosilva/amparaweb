import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMapbox } from "@/hooks/useMapbox";
import { X, MapPin, Smartphone, RefreshCw } from "lucide-react";

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

interface UfStats {
  usuarios: number;
  online: number;
  alertas: number;
  monitorando: number;
}

interface AlertItem {
  id: string;
  lat: number;
  lng: number;
  status: string;
  protocolo: string | null;
  criado_em: string;
  userName: string;
  tipo_acionamento: string | null;
}

interface DeviceItem {
  id: string;
  lat: number;
  lng: number;
  status: string;
  userName: string;
  bateria: number | null;
  lastPing: string | null;
  isMonitoring: boolean;
  deviceInfo: string | null;
}

type SelectedItem =
  | { type: "uf"; uf: string; stats: UfStats }
  | { type: "alert"; data: AlertItem }
  | { type: "device"; data: DeviceItem };

const cardStyle = { background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" };
const titleStyle = { color: "hsl(220 13% 18%)" };
const subtitleStyle = { color: "hsl(220 9% 46%)" };

export default function DashboardMapCard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const { mapboxgl: mapboxglInstance, loading: mbLoading } = useMapbox();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [geojson, setGeojson] = useState<any>(null);
  const [stats, setStats] = useState<Record<string, UfStats>>({});
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [loading, setLoading] = useState(false);

  // Summary
  const totalOnline = Object.values(stats).reduce((a, s) => a + s.online, 0);
  const totalAlertas = alerts.filter((a) => a.status === "ativo").length;
  const totalMonitorando = Object.values(stats).reduce((a, s) => a + s.monitorando, 0);

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

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: users }, { data: deviceData }, { data: alertData }, { data: locations }] = await Promise.all([
      supabase.from("usuarios").select("id, nome_completo, endereco_uf, endereco_lat, endereco_lon, status"),
      supabase.from("device_status").select("*").order("updated_at", { ascending: false }),
      supabase.from("alertas_panico").select("*").gte("criado_em", since).order("criado_em", { ascending: false }).limit(50),
      supabase.from("localizacoes").select("user_id, latitude, longitude, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    ]);

    const userMap: Record<string, { nome: string; uf: string; lat: number | null; lng: number | null }> = {};
    (users || []).forEach((u) => {
      userMap[u.id] = { nome: u.nome_completo, uf: u.endereco_uf || "", lat: u.endereco_lat, lng: u.endereco_lon };
    });

    // UF stats
    const ufStats: Record<string, UfStats> = {};
    const ensureUf = (uf: string) => { if (!ufStats[uf]) ufStats[uf] = { usuarios: 0, online: 0, alertas: 0, monitorando: 0 }; };
    (users || []).forEach((u) => { if (u.endereco_uf && u.status === "ativo") { ensureUf(u.endereco_uf); ufStats[u.endereco_uf].usuarios++; } });

    const latestDeviceByUser: Record<string, any> = {};
    (deviceData || []).forEach((d) => { if (!latestDeviceByUser[d.user_id]) latestDeviceByUser[d.user_id] = d; });
    Object.values(latestDeviceByUser).forEach((d: any) => {
      const uf = userMap[d.user_id]?.uf;
      if (uf) { ensureUf(uf); if (d.status === "online") ufStats[uf].online++; if (d.is_monitoring) ufStats[uf].monitorando++; }
    });
    (alertData || []).forEach((a) => { const uf = userMap[a.user_id]?.uf; if (uf) { ensureUf(uf); ufStats[uf].alertas++; } });
    setStats(ufStats);

    // Alert items
    setAlerts(
      (alertData || []).filter((a) => a.latitude && a.longitude).map((a) => ({
        id: a.id, lat: a.latitude!, lng: a.longitude!, status: a.status,
        protocolo: a.protocolo, criado_em: a.criado_em, userName: userMap[a.user_id]?.nome || "—",
        tipo_acionamento: a.tipo_acionamento,
      }))
    );

    // Device items
    const userLastLoc: Record<string, { lat: number; lng: number }> = {};
    (locations || []).forEach((l) => { if (!userLastLoc[l.user_id]) userLastLoc[l.user_id] = { lat: l.latitude, lng: l.longitude }; });
    setDevices(
      Object.entries(latestDeviceByUser).map(([userId, d]: [string, any]) => {
        const loc = userLastLoc[userId]; const user = userMap[userId];
        if (!loc && !user?.lat) return null;
        return {
          id: d.id, lat: loc?.lat || user?.lat || 0, lng: loc?.lng || user?.lng || 0,
          status: d.status, userName: user?.nome || "—", bateria: d.bateria_percentual,
          lastPing: d.last_ping_at, isMonitoring: d.is_monitoring, deviceInfo: d.dispositivo_info,
        };
      }).filter(Boolean) as DeviceItem[]
    );

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !mapboxglInstance) return;
    const map = new mapboxglInstance.Map({
      container: mapContainer.current,
      style: {
        version: 8, name: "Dashboard", glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sources: { "tiles": { type: "raster", tiles: ["https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png"], tileSize: 256 } },
        layers: [{ id: "tiles-layer", type: "raster", source: "tiles", minzoom: 0, maxzoom: 22 }],
      },
      center: [-52, -15], zoom: 3.2, maxBounds: [[-75, -35], [-28, 6]], minZoom: 2.8,
      attributionControl: false,
    });
    map.once("load", () => map.fitBounds([[-73.5, -33.7], [-34.8, 5.3]], { padding: 20, duration: 0 }));
    map.addControl(new mapboxglInstance.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setMapLoaded(true));
    mapRef.current = map;
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, [mapboxglInstance]);

  // Choropleth
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geojson) return;
    const enriched = {
      ...geojson,
      features: geojson.features.map((f: any) => {
        const uf = f.properties.uf_code;
        const s = stats[uf] || { usuarios: 0, online: 0, alertas: 0, monitorando: 0 };
        return { ...f, properties: { ...f.properties, ...s } };
      }),
    };
    if (map.getSource("states")) {
      (map.getSource("states") as any).setData(enriched);
    } else {
      map.addSource("states", { type: "geojson", data: enriched });
      map.addLayer({
        id: "states-fill", type: "fill", source: "states",
        paint: { "fill-color": ["step", ["get", "usuarios"], "#e5e7eb", 1, "#bfdbfe", 5, "#93c5fd", 10, "#60a5fa", 20, "#3b82f6"], "fill-opacity": 0.6 },
      });
      map.addLayer({
        id: "states-outline", type: "line", source: "states",
        paint: { "line-color": "hsl(220, 13%, 70%)", "line-width": 1 },
      });

      // Labels
      const labelFeatures = enriched.features.map((f: any) => {
        const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
        const lngs = coords.map((c: number[]) => c[0]); const lats = coords.map((c: number[]) => c[1]);
        return { type: "Feature", geometry: { type: "Point", coordinates: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] }, properties: { uf_code: f.properties.uf_code, usuarios: f.properties.usuarios || 0, online: f.properties.online || 0 } };
      });
      map.addSource("state-labels", { type: "geojson", data: { type: "FeatureCollection", features: labelFeatures } });
      map.addLayer({
        id: "state-labels-layer", type: "symbol", source: "state-labels",
        layout: { "text-field": ["case", [">", ["get", "usuarios"], 0], ["concat", ["get", "uf_code"], "\n", ["to-string", ["get", "usuarios"]], "u · ", ["to-string", ["get", "online"]], "on"], ["get", "uf_code"]], "text-size": 10, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": false },
        paint: { "text-color": "hsl(220, 13%, 25%)", "text-halo-color": "hsl(0, 0%, 100%)", "text-halo-width": 1.5 },
      });

      // Click handler
      map.on("click", "states-fill", (e: any) => {
        if (e.features?.length) {
          const p = e.features[0].properties;
          const uf = p.uf_code;
          setSelected({ type: "uf", uf, stats: { usuarios: p.usuarios || 0, online: p.online || 0, alertas: p.alertas || 0, monitorando: p.monitorando || 0 } });
        }
      });
      map.on("mouseenter", "states-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "states-fill", () => { map.getCanvas().style.cursor = ""; });
    }
  }, [geojson, stats, mapLoaded]);

  // Markers
  useEffect(() => {
    const map = mapRef.current; const mbgl = mapboxglInstance;
    if (!map || !mbgl || !mapLoaded) return;
    markersRef.current.forEach((m) => m.remove()); markersRef.current = [];

    // Alert markers removed — no need to show active alert details on map

    devices.forEach((d) => {
      const isOnline = d.status === "online";
      const el = document.createElement("div");
      el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${isOnline ? "hsl(142,71%,35%)" : "hsl(220,9%,60%)"};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer`;
      el.addEventListener("click", (e) => { e.stopPropagation(); setSelected({ type: "device", data: d }); });
      const marker = new mbgl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map);
      markersRef.current.push(marker);
    });
  }, [alerts, devices, mapLoaded, mapboxglInstance]);

  return (
    <div className="rounded-md border relative overflow-hidden" style={cardStyle}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "hsl(220 13% 91%)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={titleStyle}>Mapa Operacional</h2>
          <p className="text-xs" style={subtitleStyle}>Últimos 7 dias — clique para detalhes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px]" style={subtitleStyle}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "hsl(142 71% 35%)" }} />
            <span>{totalOnline} online</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]" style={subtitleStyle}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "hsl(224 76% 48%)" }} />
            <span>{totalMonitorando} monit.</span>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} style={subtitleStyle} />
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="relative" style={{ height: 340 }}>
        {mbLoading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(210 17% 96%)" }}>
            <p className="text-xs" style={subtitleStyle}>Carregando mapa…</p>
          </div>
        )}
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      {/* Detail drawer */}
      {selected && (
        <div
          className="absolute bottom-0 left-0 right-0 z-20 border-t px-4 py-4 animate-in slide-in-from-bottom-4 duration-200"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {selected.type === "uf" && <MapPin className="w-4 h-4" style={{ color: "hsl(224 76% 48%)" }} />}
              {selected.type === "device" && <Smartphone className="w-4 h-4" style={{ color: "hsl(142 71% 35%)" }} />}
              <span className="text-sm font-semibold" style={titleStyle}>
                {selected.type === "uf" && `${UF_TO_STATE_NAME[selected.uf] || selected.uf} (${selected.uf})`}
                {selected.type === "device" && selected.data.userName}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-gray-100">
              <X className="w-4 h-4" style={subtitleStyle} />
            </button>
          </div>

          {selected.type === "uf" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Usuárias ativas", value: selected.stats.usuarios, color: "hsl(220 13% 18%)" },
                { label: "Dispositivos online", value: selected.stats.online, color: "hsl(142 71% 35%)" },
                { label: "Em monitoramento", value: selected.stats.monitorando, color: "hsl(224 76% 48%)" },
                { label: "Alertas no período", value: selected.stats.alertas, color: "hsl(0 72% 51%)" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border px-3 py-2" style={{ borderColor: "hsl(220 13% 91%)" }}>
                  <p className="text-[10px] mb-0.5" style={subtitleStyle}>{item.label}</p>
                  <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}




          {selected.type === "device" && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                { label: "Usuária", value: selected.data.userName },
                { label: "Status", value: selected.data.status === "online" ? "🟢 Online" : "⚫ Offline" },
                { label: "Monitorando", value: selected.data.isMonitoring ? "Sim" : "Não" },
                { label: "Bateria", value: selected.data.bateria != null ? `${selected.data.bateria}%` : "—" },
                { label: "Último ping", value: selected.data.lastPing ? new Date(selected.data.lastPing).toLocaleString("pt-BR") : "—" },
                { label: "Dispositivo", value: selected.data.deviceInfo || "—" },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-[10px] font-medium" style={subtitleStyle}>{f.label}</p>
                  <p className="text-xs font-medium" style={titleStyle}>{f.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
