import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMapbox } from "@/hooks/useMapbox";
import { MapPin, AlertTriangle, Smartphone, Users, RefreshCw } from "lucide-react";

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

interface AlertMarker {
  id: string;
  lat: number;
  lng: number;
  status: string;
  protocolo: string | null;
  criado_em: string;
  userName: string;
}

interface DeviceMarker {
  id: string;
  lat: number;
  lng: number;
  status: string;
  userName: string;
  bateria: number | null;
  lastPing: string | null;
  isMonitoring: boolean;
}

interface UfStats {
  usuarios: number;
  online: number;
  alertas: number;
  monitorando: number;
}

type StatsMap = Record<string, UfStats>;

export default function AdminMapa() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const { mapboxgl: mapboxglInstance, loading: mbLoading } = useMapbox();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [geojson, setGeojson] = useState<any>(null);
  const [stats, setStats] = useState<StatsMap>({});
  const [alerts, setAlerts] = useState<AlertMarker[]>([]);
  const [devices, setDevices] = useState<DeviceMarker[]>([]);
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showDevices, setShowDevices] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");

  // Summary counts
  const totalUsuarios = Object.values(stats).reduce((a, s) => a + s.usuarios, 0);
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
          properties: {
            ...f.properties,
            uf_code: STATE_NAME_TO_UF[f.properties.name] || f.properties.name,
          },
        }));
        setGeojson(data);
      })
      .catch(console.error);
  }, []);

  // Fetch operational data
  const fetchData = useCallback(async () => {
    setLoading(true);

    const periodHours = { "24h": 24, "7d": 168, "30d": 720 }[period];
    const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    const [
      { data: users },
      { data: deviceData },
      { data: alertData },
      { data: locations },
    ] = await Promise.all([
      supabase.from("usuarios").select("id, nome_completo, endereco_uf, endereco_lat, endereco_lon, status"),
      supabase.from("device_status").select("*").order("updated_at", { ascending: false }),
      supabase.from("alertas_panico").select("*").gte("criado_em", since).order("criado_em", { ascending: false }).limit(50),
      supabase.from("localizacoes").select("user_id, latitude, longitude, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    ]);

    const userMap: Record<string, { nome: string; uf: string; lat: number | null; lng: number | null }> = {};
    (users || []).forEach((u) => {
      userMap[u.id] = {
        nome: u.nome_completo,
        uf: u.endereco_uf || "",
        lat: u.endereco_lat,
        lng: u.endereco_lon,
      };
    });

    // Build UF stats
    const ufStats: StatsMap = {};
    const ensureUf = (uf: string) => {
      if (!ufStats[uf]) ufStats[uf] = { usuarios: 0, online: 0, alertas: 0, monitorando: 0 };
    };

    (users || []).forEach((u) => {
      if (u.endereco_uf && u.status === "ativo") {
        ensureUf(u.endereco_uf);
        ufStats[u.endereco_uf].usuarios++;
      }
    });

    // Latest device per user
    const latestDeviceByUser: Record<string, any> = {};
    (deviceData || []).forEach((d) => {
      if (!latestDeviceByUser[d.user_id]) latestDeviceByUser[d.user_id] = d;
    });

    // Online devices & monitoring
    Object.values(latestDeviceByUser).forEach((d: any) => {
      const uf = userMap[d.user_id]?.uf;
      if (uf) {
        ensureUf(uf);
        if (d.status === "online") ufStats[uf].online++;
        if (d.is_monitoring) ufStats[uf].monitorando++;
      }
    });

    // Alerts per UF
    (alertData || []).forEach((a) => {
      const uf = userMap[a.user_id]?.uf;
      if (uf) {
        ensureUf(uf);
        ufStats[uf].alertas++;
      }
    });

    setStats(ufStats);

    // Build alert markers
    const alertMarkers: AlertMarker[] = (alertData || [])
      .filter((a) => a.latitude && a.longitude)
      .map((a) => ({
        id: a.id,
        lat: a.latitude!,
        lng: a.longitude!,
        status: a.status,
        protocolo: a.protocolo,
        criado_em: a.criado_em,
        userName: userMap[a.user_id]?.nome || "—",
      }));
    setAlerts(alertMarkers);

    // Build device markers from latest locations
    const userLastLocation: Record<string, { lat: number; lng: number; created_at: string }> = {};
    (locations || []).forEach((l) => {
      if (!userLastLocation[l.user_id]) {
        userLastLocation[l.user_id] = { lat: l.latitude, lng: l.longitude, created_at: l.created_at };
      }
    });

    const deviceMarkers: DeviceMarker[] = Object.entries(latestDeviceByUser)
      .map(([userId, d]: [string, any]) => {
        const loc = userLastLocation[userId];
        const user = userMap[userId];
        if (!loc && !user?.lat) return null;
        return {
          id: d.id,
          lat: loc?.lat || user?.lat || 0,
          lng: loc?.lng || user?.lng || 0,
          status: d.status,
          userName: user?.nome || "—",
          bateria: d.bateria_percentual,
          lastPing: d.last_ping_at,
          isMonitoring: d.is_monitoring,
        };
      })
      .filter(Boolean) as DeviceMarker[];
    setDevices(deviceMarkers);

    setLastRefresh(new Date());
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !mapboxglInstance) return;

    const map = new mapboxglInstance.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        name: "Admin Clean",
        glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
        sources: {
          "simple-tiles": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
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
      maxBounds: [[-75, -35], [-28, 6]],
      minZoom: 2.8,
    });

    map.once("load", () => {
      map.fitBounds([[-73.5, -33.7], [-34.8, 5.3]], { padding: 30, duration: 0 });
    });

    map.addControl(new mapboxglInstance.NavigationControl(), "top-right");
    map.on("load", () => setMapLoaded(true));
    mapRef.current = map;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
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
        return {
          ...f,
          properties: { ...f.properties, usuarios: s.usuarios, online: s.online, alertas: s.alertas, monitorando: s.monitorando },
        };
      }),
    };

    if (map.getSource("states")) {
      (map.getSource("states") as any).setData(enriched);
    } else {
      map.addSource("states", { type: "geojson", data: enriched });

      map.addLayer({
        id: "states-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": [
            "step", ["get", "usuarios"],
            "#e5e7eb", 1, "#bfdbfe", 5, "#93c5fd", 10, "#60a5fa", 20, "#3b82f6",
          ],
          "fill-opacity": 0.6,
        },
      });

      map.addLayer({
        id: "states-outline",
        type: "line",
        source: "states",
        paint: { "line-color": "hsl(220, 13%, 70%)", "line-width": 1 },
      });

      map.addLayer({
        id: "states-hover",
        type: "fill",
        source: "states",
        paint: { "fill-color": "hsl(224, 76%, 33%)", "fill-opacity": 0.15 },
        filter: ["==", "uf_code", ""],
      });

      // Labels
      const labelFeatures = enriched.features.map((f: any) => {
        const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
        const lngs = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] },
          properties: { uf_code: f.properties.uf_code, usuarios: f.properties.usuarios || 0 },
        };
      });

      map.addSource("state-labels", { type: "geojson", data: { type: "FeatureCollection", features: labelFeatures } });
      map.addLayer({
        id: "state-labels-layer",
        type: "symbol",
        source: "state-labels",
        layout: {
          "text-field": [
            "case",
            [">", ["get", "usuarios"], 0],
            ["concat", ["get", "uf_code"], " (", ["to-string", ["get", "usuarios"]], ")"],
            ["get", "uf_code"],
          ],
          "text-size": 11,
          "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": false,
          "text-anchor": "center",
        },
        paint: {
          "text-color": "hsl(220, 13%, 25%)",
          "text-halo-color": "hsl(0, 0%, 100%)",
          "text-halo-width": 1.5,
        },
      });

      // Tooltip
      const mbgl = mapboxglInstance;
      if (!mbgl) return;
      const popup = new mbgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "240px" });

      map.on("mousemove", "states-fill", (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        if (e.features?.length) {
          const p = e.features[0].properties;
          map.setFilter("states-hover", ["==", "uf_code", p.uf_code]);
          const stateName = UF_TO_STATE_NAME[p.uf_code] || p.uf_code;
          popup.setLngLat(e.lngLat).setHTML(`
            <div style="font-family:Inter,Roboto,sans-serif;font-size:11px;line-height:1.6;color:hsl(220,13%,18%)">
              <strong style="font-size:13px">${stateName}</strong>
              <div style="margin-top:4px;display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Usuárias ativas</span><strong>${p.usuarios || 0}</strong></div>
              <div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Dispositivos online</span><strong style="color:hsl(142,71%,35%)">${p.online || 0}</strong></div>
              <div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Monitorando</span><strong style="color:hsl(224,76%,33%)">${p.monitorando || 0}</strong></div>
              <div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Alertas ativos</span><strong style="color:hsl(0,72%,51%)">${p.alertas || 0}</strong></div>
            </div>
          `).addTo(map);
        }
      });
      map.on("mouseleave", "states-fill", () => {
        map.getCanvas().style.cursor = "";
        map.setFilter("states-hover", ["==", "uf_code", ""]);
        popup.remove();
      });

      map.on("click", "states-fill", (e: any) => {
        if (e.features?.length) {
          const uf = e.features[0].properties.uf_code;
          setSelectedUf((prev) => (prev === uf ? null : uf));
        }
      });
    }
  }, [geojson, stats, mapLoaded]);

  // Update labels when stats change and source exists
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geojson || !map.getSource("state-labels")) return;

    const labelFeatures = geojson.features.map((f: any) => {
      const uf = f.properties.uf_code;
      const s = stats[uf] || { usuarios: 0 };
      const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
      const lngs = coords.map((c: number[]) => c[0]);
      const lats = coords.map((c: number[]) => c[1]);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] },
        properties: { uf_code: uf, usuarios: s.usuarios || 0 },
      };
    });
    (map.getSource("state-labels") as any).setData({ type: "FeatureCollection", features: labelFeatures });
  }, [stats, mapLoaded, geojson]);

  // Markers for alerts and devices
  useEffect(() => {
    const map = mapRef.current;
    const mbgl = mapboxglInstance;
    if (!map || !mbgl || !mapLoaded) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Alert markers
    if (showAlerts) {
      alerts.forEach((a) => {
        const el = document.createElement("div");
        el.style.cssText = "width:28px;height:28px;border-radius:50%;background:hsl(0,72%,51%);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite";
        el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

        const popup = new mbgl.Popup({ offset: 15, maxWidth: "220px" }).setHTML(`
          <div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.5">
            <strong style="color:hsl(0,72%,51%)">⚠ Alerta Ativo</strong>
            <div style="margin-top:4px"><span style="color:hsl(220,9%,46%)">Usuária:</span> ${a.userName}</div>
            ${a.protocolo ? `<div><span style="color:hsl(220,9%,46%)">Protocolo:</span> ${a.protocolo}</div>` : ""}
            <div><span style="color:hsl(220,9%,46%)">Horário:</span> ${new Date(a.criado_em).toLocaleString("pt-BR")}</div>
          </div>
        `);

        const marker = new mbgl.Marker({ element: el }).setLngLat([a.lng, a.lat]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
      });
    }

    // Device markers
    if (showDevices) {
      devices.forEach((d) => {
        const isOnline = d.status === "online";
        const el = document.createElement("div");
        el.style.cssText = `width:20px;height:20px;border-radius:50%;background:${isOnline ? "hsl(142,71%,35%)" : "hsl(220,9%,60%)"};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer`;

        const popup = new mbgl.Popup({ offset: 12, maxWidth: "220px" }).setHTML(`
          <div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.5">
            <strong>${d.userName}</strong>
            <div style="margin-top:4px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isOnline ? "hsl(142,71%,35%)" : "hsl(220,9%,60%)"};margin-right:4px"></span>
              ${isOnline ? "Online" : "Offline"}
              ${d.isMonitoring ? ' · <span style="color:hsl(224,76%,33%)">Monitorando</span>' : ""}
            </div>
            ${d.bateria != null ? `<div><span style="color:hsl(220,9%,46%)">Bateria:</span> ${d.bateria}%</div>` : ""}
            ${d.lastPing ? `<div><span style="color:hsl(220,9%,46%)">Último ping:</span> ${new Date(d.lastPing).toLocaleString("pt-BR")}</div>` : ""}
          </div>
        `);

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
        const lngs = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, duration: 1200 });
      }
    } else {
      map.fitBounds([[-73.5, -33.7], [-34.8, 5.3]], { padding: 30, duration: 1200 });
    }
  }, [selectedUf, mapLoaded, geojson]);

  // Top UFs by online
  const topUfs = Object.entries(stats)
    .filter(([, s]) => s.usuarios > 0)
    .sort(([, a], [, b]) => b.online - a.online)
    .slice(0, 8);

  return (
    <div style={fontStyle}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs mb-0.5" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Mapa</p>
          <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
            Mapa Operacional
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {([["24h", "24h"], ["7d", "7 dias"], ["30d", "30 dias"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className="px-3 py-1.5 text-xs rounded-md border transition-colors"
                style={{
                  borderColor: period === key ? "hsl(224 76% 33%)" : "hsl(220 13% 91%)",
                  background: period === key ? "hsl(224 76% 33%)" : "transparent",
                  color: period === key ? "#fff" : "hsl(220 9% 46%)",
                  fontWeight: period === key ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}
          >
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
          <div
            key={label}
            className="rounded-lg border p-3 flex items-center gap-3"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-lg font-bold leading-none" style={{ color }}>{value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "hsl(220 9% 46%)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Map + sidebar */}
      <div className="flex flex-col md:flex-row rounded-lg border overflow-hidden" style={{ borderColor: "hsl(220 13% 91%)", height: "calc(100vh - 290px)", minHeight: "400px" }}>
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full min-h-[400px]" />
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(210 17% 96%)" }}>
              <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Carregando mapa…</p>
            </div>
          )}

          {/* Legend overlay */}
          <div
            className="absolute bottom-3 left-3 rounded-lg border p-3"
            style={{ background: "hsl(0 0% 100% / 0.95)", borderColor: "hsl(220 13% 91%)", backdropFilter: "blur(8px)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(220 9% 46%)" }}>
              Legenda
            </p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showAlerts} onChange={(e) => setShowAlerts(e.target.checked)} className="rounded" />
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "hsl(0,72%,51%)" }} />
                <span className="text-[11px]" style={{ color: "hsl(220 13% 18%)" }}>Alertas ativos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showDevices} onChange={(e) => setShowDevices(e.target.checked)} className="rounded" />
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "hsl(142,71%,35%)" }} />
                <span className="text-[11px]" style={{ color: "hsl(220 13% 18%)" }}>Dispositivos online</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "hsl(220,9%,60%)" }} />
                <span className="text-[11px]" style={{ color: "hsl(220 13% 18%)" }}>Dispositivos offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div
          className="w-full md:w-72 border-t md:border-t-0 md:border-l overflow-y-auto p-4"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          {selectedUf ? (
            <>
              <h3 className="text-sm font-bold mb-3" style={{ color: "hsl(220 13% 18%)" }}>
                {UF_TO_STATE_NAME[selectedUf] || selectedUf} — {selectedUf}
              </h3>
              {stats[selectedUf] ? (
                <div className="space-y-2 mb-4">
                  {[
                    { label: "Usuárias ativas", value: stats[selectedUf].usuarios, color: "hsl(224 76% 33%)" },
                    { label: "Online", value: stats[selectedUf].online, color: "hsl(142 71% 35%)" },
                    { label: "Monitorando", value: stats[selectedUf].monitorando, color: "hsl(262 83% 58%)" },
                    { label: "Alertas ativos", value: stats[selectedUf].alertas, color: "hsl(0 72% 51%)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ background: "hsl(210 17% 96%)" }}>
                      <span className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>{label}</span>
                      <span className="text-sm font-bold" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs py-3 text-center rounded-lg mb-4" style={{ color: "hsl(220 9% 46%)", background: "hsl(210 17% 96%)" }}>
                  Sem dados para este estado
                </p>
              )}
              <button
                onClick={() => setSelectedUf(null)}
                className="w-full text-xs font-medium px-3 py-2 rounded-lg border transition-colors hover:bg-gray-50"
                style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
              >
                ← Voltar para Brasil
              </button>
            </>
          ) : (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "hsl(220 9% 46%)" }}>
                Ranking por UF
              </h3>
              {topUfs.length === 0 ? (
                <p className="text-xs py-3 text-center rounded-lg" style={{ color: "hsl(220 9% 46%)", background: "hsl(210 17% 96%)" }}>
                  Nenhum dado disponível
                </p>
              ) : (
                <div className="space-y-1">
                  {topUfs.map(([uf, s]) => (
                    <button
                      key={uf}
                      onClick={() => setSelectedUf(uf)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs hover:bg-gray-50 transition-colors text-left"
                      style={{ background: "hsl(210 17% 96%)" }}
                    >
                      <span className="font-medium" style={{ color: "hsl(220 13% 18%)" }}>{UF_TO_STATE_NAME[uf] || uf}</span>
                      <div className="flex items-center gap-3">
                        <span style={{ color: "hsl(142 71% 35%)" }}>{s.online} on</span>
                        {s.alertas > 0 && (
                          <span className="font-bold" style={{ color: "hsl(0 72% 51%)" }}>{s.alertas} ⚠</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Active alerts list */}
              {alerts.length > 0 && (
                <>
                  <hr className="my-4" style={{ borderColor: "hsl(220 13% 91%)" }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "hsl(0 72% 51%)" }}>
                    Alertas Ativos ({alerts.length})
                  </h3>
                  <div className="space-y-1.5">
                    {alerts.slice(0, 5).map((a) => (
                      <div
                        key={a.id}
                        className="rounded-lg px-3 py-2 text-xs"
                        style={{ background: "hsl(0 72% 51% / 0.06)" }}
                      >
                        <div className="font-medium" style={{ color: "hsl(220 13% 18%)" }}>{a.userName}</div>
                        <div style={{ color: "hsl(220 9% 46%)" }}>
                          {new Date(a.criado_em).toLocaleString("pt-BR")}
                          {a.protocolo && ` · ${a.protocolo}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Last refresh */}
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid hsl(220 13% 91%)" }}>
            <p className="text-[10px] text-center" style={{ color: "hsl(220 9% 60%)" }}>
              Atualizado em {lastRefresh.toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
