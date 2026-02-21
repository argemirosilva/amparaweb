import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMapbox } from "@/hooks/useMapbox";
import { MapPin, AlertTriangle, Smartphone, Users, RefreshCw, BarChart3, Mic, Clock } from "lucide-react";
import GovKpiCard from "@/components/institucional/GovKpiCard";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";
import WordCloudCard from "@/components/institucional/WordCloudCard";
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
  "hsl(160 25% 45%)", "hsl(40 35% 52%)", "hsl(25 35% 50%)",
  "hsl(0 30% 50%)", "hsl(220 10% 65%)",
];

const BAR_COLORS = [
  "hsl(215 25% 50%)", "hsl(250 20% 52%)", "hsl(310 25% 48%)",
  "hsl(190 30% 45%)", "hsl(160 25% 42%)", "hsl(40 35% 52%)",
  "hsl(25 35% 50%)", "hsl(0 30% 50%)", "hsl(270 20% 45%)",
  "hsl(200 25% 50%)", "hsl(150 22% 45%)", "hsl(335 25% 47%)",
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

// Approximate centroids for major Brazilian cities (fallback when user has no GPS but has city)
const CITY_CENTROID: Record<string, [number, number]> = {
  "São Paulo-SP": [-23.55, -46.63], "Campinas-SP": [-22.91, -47.06], "Santos-SP": [-23.96, -46.33],
  "Ribeirão Preto-SP": [-21.18, -47.81], "Osasco-SP": [-23.53, -46.79], "Guarulhos-SP": [-23.46, -46.53],
  "São Bernardo do Campo-SP": [-23.69, -46.56], "Sorocaba-SP": [-23.50, -47.46], "Bauru-SP": [-22.31, -49.07],
  "São José dos Campos-SP": [-23.19, -45.88], "Jundiaí-SP": [-23.19, -46.88], "Piracicaba-SP": [-22.73, -47.65],
  "Mogi das Cruzes-SP": [-23.52, -46.19], "Santo André-SP": [-23.67, -46.54], "Diadema-SP": [-23.69, -46.62],
  "Carapicuíba-SP": [-23.52, -46.84], "Itaquaquecetuba-SP": [-23.49, -46.35], "Barueri-SP": [-23.51, -46.88],
  "Rio de Janeiro-RJ": [-22.91, -43.17], "Niterói-RJ": [-22.88, -43.10], "São Gonçalo-RJ": [-22.83, -43.06],
  "Duque de Caxias-RJ": [-22.79, -43.31], "Nova Iguaçu-RJ": [-22.76, -43.45], "Petrópolis-RJ": [-22.51, -43.18],
  "Volta Redonda-RJ": [-22.52, -44.10], "Campos dos Goytacazes-RJ": [-21.76, -41.30],
  "Belo Horizonte-MG": [-19.92, -43.94], "Uberlândia-MG": [-18.92, -48.28], "Contagem-MG": [-19.93, -44.05],
  "Juiz de Fora-MG": [-21.76, -43.35], "Betim-MG": [-19.97, -44.20], "Montes Claros-MG": [-16.74, -43.86],
  "Curitiba-PR": [-25.43, -49.27], "Londrina-PR": [-23.31, -51.16], "Maringá-PR": [-23.42, -51.94],
  "Ponta Grossa-PR": [-25.09, -50.16], "Cascavel-PR": [-24.96, -53.46], "Foz do Iguaçu-PR": [-25.55, -54.59],
  "Porto Alegre-RS": [-30.03, -51.23], "Caxias do Sul-RS": [-29.17, -51.18], "Pelotas-RS": [-31.77, -52.34],
  "Canoas-RS": [-29.92, -51.17], "Santa Maria-RS": [-29.69, -53.81],
  "Florianópolis-SC": [-27.60, -48.55], "Joinville-SC": [-26.30, -48.85], "Blumenau-SC": [-26.92, -49.07],
  "Salvador-BA": [-12.97, -38.51], "Feira de Santana-BA": [-12.27, -38.97], "Vitória da Conquista-BA": [-14.86, -40.84],
  "Recife-PE": [-8.05, -34.87], "Jaboatão dos Guararapes-PE": [-8.11, -35.02], "Olinda-PE": [-8.01, -34.86],
  "Fortaleza-CE": [-3.72, -38.53], "Caucaia-CE": [-3.74, -38.66],
  "Manaus-AM": [-3.12, -60.02], "Belém-PA": [-1.46, -48.50], "Ananindeua-PA": [-1.37, -48.39],
  "São Luís-MA": [-2.53, -44.28], "Teresina-PI": [-5.09, -42.80],
  "Natal-RN": [-5.79, -35.21], "João Pessoa-PB": [-7.12, -34.84], "Maceió-AL": [-9.67, -35.74],
  "Aracaju-SE": [-10.91, -37.07], "Vitória-ES": [-20.32, -40.34],
  "Goiânia-GO": [-16.69, -49.25], "Aparecida de Goiânia-GO": [-16.82, -49.24],
  "Cuiabá-MT": [-15.60, -56.10], "Campo Grande-MS": [-20.44, -54.65],
  "Brasília-DF": [-15.79, -47.88], "Porto Velho-RO": [-8.76, -63.90], "Rio Branco-AC": [-9.97, -67.81],
  "Macapá-AP": [0.03, -51.07], "Boa Vista-RR": [2.82, -60.67], "Palmas-TO": [-10.18, -48.33],
  "Ji-Paraná-RO": [-10.88, -61.95], "Ariquemes-RO": [-9.91, -63.04], "Vilhena-RO": [-12.74, -60.15],
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

interface UfStats { usuarios: number; online: number; alertas: number; monitorando: number; gravacoes: number; horasGravacao: number; }
type StatsMap = Record<string, UfStats>;
interface RecTrend { trend: "up" | "down" | "stable"; pct: number }

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
  const [period, setPeriod] = useState<"24h" | "7d" | "30d" | "6m" | "12m">("7d");
  const [ufTrends, setUfTrends] = useState<Record<string, "up" | "down" | "stable">>({});
  const [recTrends, setRecTrends] = useState<Record<string, RecTrend>>({});

  // Ranking mode selector
  const [rankingMode, setRankingMode] = useState<"gravacoes" | "risco" | "panico">("gravacoes");
  const [ufRiskStats, setUfRiskStats] = useState<Record<string, { total: number; altoCritico: number }>>({});
  const [ufPanicoStats, setUfPanicoStats] = useState<Record<string, number>>({});
  const [munRiskStats, setMunRiskStats] = useState<Record<string, Record<string, { total: number; altoCritico: number }>>>({});
  const [munPanicoStats, setMunPanicoStats] = useState<Record<string, Record<string, number>>>({});

  // Dashboard analytics state
  // analyticsPeriod removed — reuses `period` from map selector
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
  const totalGravacoes = Object.values(stats).reduce((a, s) => a + s.gravacoes, 0);
  const totalHorasGrav = Math.round(Object.values(stats).reduce((a, s) => a + s.horasGravacao, 0) * 10) / 10;

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
    const periodHours = { "24h": 24, "7d": 168, "30d": 720, "6m": 4320, "12m": 8760 }[period];
    const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    const [
      { data: users }, { data: deviceData }, { data: alertData }, { data: locations }, { data: gravacoesData },
    ] = await Promise.all([
      supabase.from("usuarios").select("id, nome_completo, endereco_uf, endereco_cidade, endereco_lat, endereco_lon, status"),
      supabase.from("device_status").select("*").order("updated_at", { ascending: false }),
      supabase.from("alertas_panico").select("*").eq("status", "ativo").order("criado_em", { ascending: false }).limit(50),
      supabase.from("localizacoes").select("user_id, latitude, longitude, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
      supabase.from("gravacoes").select("user_id, created_at, duracao_segundos").gte("created_at", since),
    ]);

    const userMap: Record<string, { nome: string; uf: string; cidade: string; lat: number | null; lng: number | null }> = {};
    (users || []).forEach((u) => { userMap[u.id] = { nome: u.nome_completo, uf: u.endereco_uf || "", cidade: u.endereco_cidade || "", lat: u.endereco_lat, lng: u.endereco_lon }; });

    const ufStats: StatsMap = {};
    const munStats: Record<string, StatsMap> = {};
    const ensureUf = (uf: string) => { if (!ufStats[uf]) ufStats[uf] = { usuarios: 0, online: 0, alertas: 0, monitorando: 0, gravacoes: 0, horasGravacao: 0 }; };
    const ensureMun = (uf: string, cidade: string) => {
      if (!cidade) return;
      if (!munStats[uf]) munStats[uf] = {};
      if (!munStats[uf][cidade]) munStats[uf][cidade] = { usuarios: 0, online: 0, alertas: 0, monitorando: 0, gravacoes: 0, horasGravacao: 0 };
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
    // Recordings per UF
    const periodHoursVal = { "24h": 24, "7d": 168, "30d": 720, "6m": 4320, "12m": 8760 }[period];
    const midpoint = new Date(Date.now() - (periodHoursVal / 2) * 60 * 60 * 1000).toISOString();
    const recentRecByUf: Record<string, number> = {};
    const olderRecByUf: Record<string, number> = {};
    (gravacoesData || []).forEach((g: any) => {
      const u = userMap[g.user_id];
      if (u?.uf) {
        ensureUf(u.uf);
        ufStats[u.uf].gravacoes++;
        ufStats[u.uf].horasGravacao += (g.duracao_segundos || 0) / 3600;
        if (u.cidade) { ensureMun(u.uf, u.cidade); munStats[u.uf][u.cidade].gravacoes++; munStats[u.uf][u.cidade].horasGravacao += (g.duracao_segundos || 0) / 3600; }
        if (g.created_at >= midpoint) recentRecByUf[u.uf] = (recentRecByUf[u.uf] || 0) + 1;
        else olderRecByUf[u.uf] = (olderRecByUf[u.uf] || 0) + 1;
      }
    });
    // Round hours
    Object.values(ufStats).forEach(s => { s.horasGravacao = Math.round(s.horasGravacao * 10) / 10; });
    Object.values(munStats).forEach(m => Object.values(m).forEach(s => { s.horasGravacao = Math.round(s.horasGravacao * 10) / 10; }));

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

    // Compute UF event trends
    {
      const [{ data: recentEvents }, { data: olderEvents }] = await Promise.all([
        supabase.from("gravacoes_analises").select("user_id").gte("created_at", midpoint),
        supabase.from("gravacoes_analises").select("user_id").gte("created_at", since).lt("created_at", midpoint),
      ]);
      const recentByUf: Record<string, number> = {};
      const olderByUf: Record<string, number> = {};
      (recentEvents || []).forEach((e) => { const uf = userMap[e.user_id]?.uf; if (uf) recentByUf[uf] = (recentByUf[uf] || 0) + 1; });
      (olderEvents || []).forEach((e) => { const uf = userMap[e.user_id]?.uf; if (uf) olderByUf[uf] = (olderByUf[uf] || 0) + 1; });
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

    // Recording trends
    const rTrends: Record<string, RecTrend> = {};
    const allRecUfs = new Set([...Object.keys(recentRecByUf), ...Object.keys(olderRecByUf)]);
    allRecUfs.forEach((uf) => {
      const r = recentRecByUf[uf] || 0;
      const o = olderRecByUf[uf] || 0;
      if (r + o < 2) { rTrends[uf] = { trend: "stable", pct: 0 }; return; }
      if (o === 0) { rTrends[uf] = { trend: r > 0 ? "up" : "stable", pct: 100 }; return; }
      const pct = Math.round(((r - o) / o) * 100);
      rTrends[uf] = { trend: pct >= 20 ? "up" : pct <= -20 ? "down" : "stable", pct: Math.abs(pct) };
    });
    setRecTrends(rTrends);

    // ── Risk stats per UF/município ──
    const { data: analisesData } = await supabase
      .from("gravacoes_analises")
      .select("user_id, nivel_risco")
      .gte("created_at", since);

    const riskByUf: Record<string, { total: number; altoCritico: number }> = {};
    const riskByMun: Record<string, Record<string, { total: number; altoCritico: number }>> = {};
    (analisesData || []).forEach((a) => {
      const u = userMap[a.user_id];
      if (!u?.uf) return;
      if (!riskByUf[u.uf]) riskByUf[u.uf] = { total: 0, altoCritico: 0 };
      riskByUf[u.uf].total++;
      if (a.nivel_risco === "alto" || a.nivel_risco === "critico") riskByUf[u.uf].altoCritico++;
      if (u.cidade) {
        if (!riskByMun[u.uf]) riskByMun[u.uf] = {};
        if (!riskByMun[u.uf][u.cidade]) riskByMun[u.uf][u.cidade] = { total: 0, altoCritico: 0 };
        riskByMun[u.uf][u.cidade].total++;
        if (a.nivel_risco === "alto" || a.nivel_risco === "critico") riskByMun[u.uf][u.cidade].altoCritico++;
      }
    });
    setUfRiskStats(riskByUf);
    setMunRiskStats(riskByMun);

    // ── Panic stats per UF/município ──
    const { data: allPanicData } = await supabase
      .from("alertas_panico")
      .select("user_id")
      .gte("criado_em", since);

    const panicoByUf: Record<string, number> = {};
    const panicoByMun: Record<string, Record<string, number>> = {};
    (allPanicData || []).forEach((p) => {
      const u = userMap[p.user_id];
      if (!u?.uf) return;
      panicoByUf[u.uf] = (panicoByUf[u.uf] || 0) + 1;
      if (u.cidade) {
        if (!panicoByMun[u.uf]) panicoByMun[u.uf] = {};
        panicoByMun[u.uf][u.cidade] = (panicoByMun[u.uf][u.cidade] || 0) + 1;
      }
    });
    setUfPanicoStats(panicoByUf);
    setMunPanicoStats(panicoByMun);

    // Build device markers for ALL active users (not just those with device_status)
    const deviceMarkers: DeviceMarker[] = (users || [])
      .filter((u) => u.status === "ativo")
      .map((u) => {
        const device = latestDeviceByUser[u.id];
        const loc = userLastLocation[u.id];
        const cityKey = u.endereco_cidade && u.endereco_uf ? `${u.endereco_cidade}-${u.endereco_uf}` : null;
        const cityCenter = cityKey ? CITY_CENTROID[cityKey] : null;
        const ufCenter = u.endereco_uf ? UF_CENTROID[u.endereco_uf] : null;
        const lat = loc?.lat ?? u.endereco_lat ?? cityCenter?.[0] ?? ufCenter?.[0];
        const lng = loc?.lng ?? u.endereco_lon ?? cityCenter?.[1] ?? ufCenter?.[1];
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
    const periodDays = { "24h": 1, "7d": 7, "30d": 30, "6m": 180, "12m": 365 }[period] || 30;
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
  }, [period]);

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
        const s = stats[uf] || { usuarios: 0, online: 0, alertas: 0, monitorando: 0, gravacoes: 0, horasGravacao: 0 };
        const rt = recTrends[uf];
        const riskAC = ufRiskStats[uf]?.altoCritico || 0;
        const panicoCount = ufPanicoStats[uf] || 0;
        return { ...f, properties: { ...f.properties, ...s, rec_trend: rt?.trend || "stable", rec_pct: rt?.pct || 0, risk_alto_critico: riskAC, panico_total: panicoCount } };
      }),
    };

    // Choose fill color expression based on ranking mode
    const fillColorExpr = rankingMode === "risco"
      ? ["step", ["get", "risk_alto_critico"], "#e5e7eb", 1, "#fecaca", 5, "#f87171", 15, "#dc2626", 30, "#991b1b"]
      : rankingMode === "panico"
      ? ["step", ["get", "panico_total"], "#e5e7eb", 1, "#fed7aa", 5, "#fb923c", 15, "#ea580c", 30, "#9a3412"]
      : ["step", ["get", "gravacoes"], "#e5e7eb", 1, "#93c5fd", 10, "#3b82f6", 30, "#1d4ed8", 80, "#1e3a5f"];

    const labelIcon = rankingMode === "risco" ? " ⚠" : rankingMode === "panico" ? " 🚨" : " 🎙";
    const labelDataKey = rankingMode === "risco" ? "risk_alto_critico" : rankingMode === "panico" ? "panico_total" : "gravacoes";
    if (map.getSource("states")) {
      (map.getSource("states") as any).setData(enriched);
      // Update choropleth color based on ranking mode
      map.setPaintProperty("states-fill", "fill-color", fillColorExpr as any);
      if (map.getSource("state-labels")) {
        const labelFeatures = enriched.features.map((f: any) => {
          const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
          const lngs = coords.map((c: number[]) => c[0]); const lats = coords.map((c: number[]) => c[1]);
          return { type: "Feature", geometry: { type: "Point", coordinates: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] }, properties: { uf_code: f.properties.uf_code, gravacoes: f.properties.gravacoes || 0, risk_alto_critico: f.properties.risk_alto_critico || 0, panico_total: f.properties.panico_total || 0, rec_trend: f.properties.rec_trend || "stable", rec_pct: f.properties.rec_pct || 0, trend: ufTrends[f.properties.uf_code] || "stable" } };
        });
        (map.getSource("state-labels") as any).setData({ type: "FeatureCollection", features: labelFeatures });
        // Update label text
        map.setLayoutProperty("state-labels-layer", "text-field", ["case", [">", ["get", labelDataKey], 0], ["concat", ["get", "uf_code"], "\n", ["to-string", ["get", labelDataKey]], labelIcon], ["get", "uf_code"]]);
      }
    } else {
      map.addSource("states", { type: "geojson", data: enriched });
      map.addLayer({ id: "states-fill", type: "fill", source: "states", paint: { "fill-color": fillColorExpr as any, "fill-opacity": 0.7 } });
      map.addLayer({ id: "states-outline", type: "line", source: "states", paint: { "line-color": "hsl(220, 13%, 70%)", "line-width": 1 } });
      map.addLayer({ id: "states-hover", type: "fill", source: "states", paint: { "fill-color": "hsl(224, 76%, 33%)", "fill-opacity": 0.15 }, filter: ["==", "uf_code", ""] });

      const labelFeatures = enriched.features.map((f: any) => {
        const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
        const lngs = coords.map((c: number[]) => c[0]); const lats = coords.map((c: number[]) => c[1]);
        return { type: "Feature", geometry: { type: "Point", coordinates: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] }, properties: { uf_code: f.properties.uf_code, gravacoes: f.properties.gravacoes || 0, risk_alto_critico: f.properties.risk_alto_critico || 0, panico_total: f.properties.panico_total || 0, rec_trend: f.properties.rec_trend || "stable", rec_pct: f.properties.rec_pct || 0, trend: ufTrends[f.properties.uf_code] || "stable" } };
      });
      map.addSource("state-labels", { type: "geojson", data: { type: "FeatureCollection", features: labelFeatures } });
      map.addLayer({
        id: "state-labels-layer", type: "symbol", source: "state-labels",
        layout: {
          "text-field": ["case", [">", ["get", labelDataKey], 0], ["concat", ["get", "uf_code"], "\n", ["to-string", ["get", labelDataKey]], labelIcon], ["get", "uf_code"]],
          "text-size": 11, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], "text-allow-overlap": false, "text-anchor": "center", "text-line-height": 1.3,
        },
        paint: { "text-color": "hsl(220, 13%, 25%)", "text-halo-color": "hsl(0, 0%, 100%)", "text-halo-width": 1.5 },
      });

      // Recording trend arrows
      map.addLayer({
        id: "state-rec-trend-layer", type: "symbol", source: "state-labels",
        filter: ["!=", ["get", "rec_trend"], "stable"],
        layout: {
          "text-field": ["concat", ["case", ["==", ["get", "rec_trend"], "up"], "▲ +", "▼ -"], ["to-string", ["get", "rec_pct"]], "%"],
          "text-size": 10, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
          "text-offset": [0, 2.0], "text-allow-overlap": true, "text-ignore-placement": true,
        },
        paint: {
          "text-color": ["case", ["==", ["get", "rec_trend"], "up"], "#dc2626", "#16a34a"],
          "text-halo-color": "hsl(0, 0%, 100%)", "text-halo-width": 1.5,
        },
      });

      const mbgl = mapboxglInstance;
      if (!mbgl) return;
      const popup = new mbgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "280px" });
      map.on("mousemove", "states-fill", (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        if (e.features?.length) {
          const p = e.features[0].properties;
          const uf = p.uf_code;
          map.setFilter("states-hover", ["==", "uf_code", uf]);
          const stateName = UF_TO_STATE_NAME[uf] || uf;
          const grav = Number(p.gravacoes) || 0;
          const horas = Number(p.horasGravacao) || 0;
          const rt = recTrends[uf];
          const trendIcon = rt?.trend === "up" ? "▲" : rt?.trend === "down" ? "▼" : "—";
          const trendColor = rt?.trend === "up" ? "#dc2626" : rt?.trend === "down" ? "#16a34a" : "hsl(220,9%,46%)";
          const trendPct = rt?.pct || 0;
          popup.setLngLat(e.lngLat).setHTML(`<div style="font-family:Inter,Roboto,sans-serif;font-size:11px;line-height:1.6;color:hsl(220,13%,18%)">
            <strong style="font-size:13px">${stateName}</strong>
            <div style="background:hsl(224,76%,96%);border-radius:6px;padding:6px 8px;margin:6px 0">
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600">🎙 Gravações</span><strong style="font-size:14px">${grav}</strong></div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">
                <span style="color:hsl(220,9%,46%);font-size:10px">⏱ ${horas}h de áudio</span>
                <span style="color:${trendColor};font-weight:700;font-size:11px">${trendIcon} ${trendPct > 0 ? trendPct + "%" : ""}</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Usuárias ativas</span><strong>${p.usuarios || 0}</strong></div>
            <div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Online</span><strong style="color:hsl(142,71%,35%)">${p.online || 0}</strong></div>
            <div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Monitorando</span><strong style="color:hsl(224,76%,33%)">${p.monitorando || 0}</strong></div>
            <div style="display:flex;justify-content:space-between"><span style="color:hsl(220,9%,46%)">Alertas ativos</span><strong style="color:hsl(0,72%,51%)">${p.alertas || 0}</strong></div>
          </div>`).addTo(map);
        }
      });
      map.on("mouseleave", "states-fill", () => { map.getCanvas().style.cursor = ""; map.setFilter("states-hover", ["==", "uf_code", ""]); popup.remove(); });
      map.on("click", "states-fill", (e: any) => { if (e.features?.length) { const uf = e.features[0].properties.uf_code; setSelectedUf((prev) => (prev === uf ? null : uf)); } });
    }
  }, [geojson, stats, recTrends, ufTrends, mapLoaded, rankingMode, ufRiskStats, ufPanicoStats]);

  // Update labels when stats or rankingMode change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geojson || !map.getSource("state-labels")) return;
    const lIcon = rankingMode === "risco" ? " ⚠" : rankingMode === "panico" ? " 🚨" : " 🎙";
    const lKey = rankingMode === "risco" ? "risk_alto_critico" : rankingMode === "panico" ? "panico_total" : "gravacoes";
    const labelFeatures = geojson.features.map((f: any) => {
      const uf = f.properties.uf_code; const s = stats[uf] || { gravacoes: 0 };
      const rt = recTrends[uf];
      const coords = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates.flat(2);
      const lngs = coords.map((c: number[]) => c[0]); const lats = coords.map((c: number[]) => c[1]);
      return { type: "Feature", geometry: { type: "Point", coordinates: [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2] }, properties: { uf_code: uf, gravacoes: s.gravacoes || 0, risk_alto_critico: ufRiskStats[uf]?.altoCritico || 0, panico_total: ufPanicoStats[uf] || 0, rec_trend: rt?.trend || "stable", rec_pct: rt?.pct || 0, trend: ufTrends[uf] || "stable" } };
    });
    (map.getSource("state-labels") as any).setData({ type: "FeatureCollection", features: labelFeatures });
    map.setLayoutProperty("state-labels-layer", "text-field", ["case", [">", ["get", lKey], 0], ["concat", ["get", "uf_code"], "\n", ["to-string", ["get", lKey]], lIcon], ["get", "uf_code"]]);
  }, [stats, ufTrends, recTrends, mapLoaded, geojson, rankingMode, ufRiskStats, ufPanicoStats]);

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

  const topUfs = Object.entries(stats)
    .filter(([, s]) => s.gravacoes > 0 || s.usuarios > 0)
    .sort(([ufA, a], [ufB, b]) => {
      if (rankingMode === "risco") return (ufRiskStats[ufB]?.altoCritico || 0) - (ufRiskStats[ufA]?.altoCritico || 0);
      if (rankingMode === "panico") return (ufPanicoStats[ufB] || 0) - (ufPanicoStats[ufA] || 0);
      return b.gravacoes - a.gravacoes;
    })
    .slice(0, 10);

  const rankingModeLabel = { gravacoes: "Gravações", risco: "Índice de Risco", panico: "Acionamentos" }[rankingMode];

  const RankingModeSelector = () => (
    <div className="flex gap-1 mb-3">
      {([["gravacoes", "Gravações"], ["risco", "Risco"], ["panico", "Pânico"]] as const).map(([key, label]) => (
        <button key={key} onClick={() => setRankingMode(key)}
          className="flex-1 px-2 py-1.5 text-[10px] rounded-md border transition-colors"
          style={{
            borderColor: rankingMode === key ? "hsl(220 13% 35%)" : "hsl(220 13% 91%)",
            background: rankingMode === key ? "hsl(220 13% 35%)" : "transparent",
            color: rankingMode === key ? "#fff" : "hsl(220 9% 46%)",
            fontWeight: rankingMode === key ? 600 : 400,
          }}>
          {label}
        </button>
      ))}
    </div>
  );

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
            {([["24h", "24h"], ["7d", "7 dias"], ["30d", "30 dias"], ["6m", "6 meses"], ["12m", "12 meses"]] as const).map(([key, label]) => (
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {[
          { icon: Mic, label: "Gravações", value: totalGravacoes, color: "hsl(224 76% 33%)", bg: "hsl(224 76% 33% / 0.08)" },
          { icon: Clock, label: "Horas Gravadas", value: `${totalHorasGrav}h`, color: "hsl(262 60% 50%)", bg: "hsl(262 60% 50% / 0.08)" },
          { icon: Users, label: "Usuárias Ativas", value: totalUsuarios, color: "hsl(220 13% 18%)", bg: "hsl(220 13% 18% / 0.08)" },
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
            </div>
          </div>
        </div>

        <div className="w-full md:w-72 border-t md:border-t-0 md:border-l overflow-y-auto p-4" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
          {selectedUf ? (
            <>
              <h3 className="text-sm font-bold mb-1" style={titleStyle}>
                {UF_TO_STATE_NAME[selectedUf] || selectedUf} — {selectedUf}
                {recTrends[selectedUf] && recTrends[selectedUf].trend !== "stable" && (
                  <span className="ml-2 text-xs font-bold" style={{ color: recTrends[selectedUf].trend === "up" ? "#dc2626" : "#16a34a" }}>
                    {recTrends[selectedUf].trend === "up" ? "▲" : "▼"} {recTrends[selectedUf].pct}%
                  </span>
                )}
              </h3>
              {stats[selectedUf] ? (
                <div className="space-y-2 mb-4">
                  {[
                    { label: "🎙 Gravações", value: stats[selectedUf].gravacoes, color: "hsl(224 76% 33%)" },
                    { label: "⏱ Horas de áudio", value: `${stats[selectedUf].horasGravacao}h`, color: "hsl(262 60% 50%)" },
                    { label: "Usuárias ativas", value: stats[selectedUf].usuarios, color: "hsl(220 13% 18%)" },
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
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mt-4 mb-2" style={subtitleStyle}>Ranking por Município — {rankingModeLabel}</h4>
                  <RankingModeSelector />
                  <div className="space-y-1">
                    {Object.entries(municipioStats[selectedUf])
                      .sort(([cidA], [cidB]) => {
                        if (rankingMode === "risco") return ((munRiskStats[selectedUf]?.[cidB]?.altoCritico || 0) - (munRiskStats[selectedUf]?.[cidA]?.altoCritico || 0));
                        if (rankingMode === "panico") return ((munPanicoStats[selectedUf]?.[cidB] || 0) - (munPanicoStats[selectedUf]?.[cidA] || 0));
                        return municipioStats[selectedUf][cidB].gravacoes - municipioStats[selectedUf][cidA].gravacoes;
                      })
                      .map(([cidade, s]) => (
                        <div key={cidade} className="flex items-center justify-between px-2 py-2 rounded-lg text-xs" style={{ background: "hsl(210 17% 96%)" }}>
                          <span className="font-medium truncate mr-2" style={titleStyle}>{cidade}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {rankingMode === "gravacoes" && (
                              <>
                                <span style={{ color: "hsl(224 76% 33%)" }}>{s.gravacoes} 🎙</span>
                                <span style={{ color: "hsl(262 60% 50%)" }}>{s.horasGravacao}h</span>
                              </>
                            )}
                            {rankingMode === "risco" && (
                              <span className="font-semibold" style={{ color: "hsl(0 45% 48%)" }}>
                                {munRiskStats[selectedUf]?.[cidade]?.altoCritico || 0} alto/crítico
                              </span>
                            )}
                            {rankingMode === "panico" && (
                              <span className="font-semibold" style={{ color: "hsl(25 50% 45%)" }}>
                                {munPanicoStats[selectedUf]?.[cidade] || 0} acionamentos
                              </span>
                            )}
                            {s.alertas > 0 && rankingMode === "gravacoes" && <span className="font-bold" style={{ color: "hsl(0 72% 51%)" }}>{s.alertas} ⚠</span>}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
              <button onClick={() => setSelectedUf(null)} className="w-full text-xs font-medium px-3 py-2 rounded-lg border transition-colors hover:bg-gray-50 mt-4" style={{ borderColor: "hsl(220 13% 35%)", color: "hsl(220 13% 35%)" }}>← Voltar para Brasil</button>
            </>
          ) : (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={subtitleStyle}>Ranking por UF — {rankingModeLabel}</h3>
              <RankingModeSelector />
              {topUfs.length === 0 ? (
                <p className="text-xs py-3 text-center rounded-lg" style={{ ...subtitleStyle, background: "hsl(210 17% 96%)" }}>Nenhum dado disponível</p>
              ) : (
                <div className="space-y-1">
                  {topUfs.map(([uf, s]) => {
                    const rt = recTrends[uf];
                    return (
                      <button key={uf} onClick={() => setSelectedUf(uf)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs hover:bg-gray-50 transition-colors text-left" style={{ background: "hsl(210 17% 96%)" }}>
                        <span className="font-medium" style={titleStyle}>{UF_TO_STATE_NAME[uf] || uf}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {rankingMode === "gravacoes" && (
                            <>
                              <span className="font-bold" style={{ color: "hsl(224 76% 33%)" }}>{s.gravacoes}</span>
                              {rt && rt.trend !== "stable" && (
                                <span className="font-bold" style={{ color: rt.trend === "up" ? "hsl(0 35% 50%)" : "hsl(160 25% 42%)" }}>
                                  {rt.trend === "up" ? "▲" : "▼"}{rt.pct}%
                                </span>
                              )}
                            </>
                          )}
                          {rankingMode === "risco" && (
                            <span className="font-semibold" style={{ color: "hsl(0 45% 48%)" }}>
                              {ufRiskStats[uf]?.altoCritico || 0} alto/crítico
                            </span>
                          )}
                          {rankingMode === "panico" && (
                            <span className="font-semibold" style={{ color: "hsl(25 50% 45%)" }}>
                              {ufPanicoStats[uf] || 0} acionamentos
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
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
          <span className="text-xs" style={subtitleStyle}>Período: {period}</span>
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
                  <Line type="monotone" dataKey="eventos" name="Eventos" stroke="hsl(215 25% 50%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="emergencias" name="Emergências" stroke="hsl(0 30% 50%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
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
                <Area type="monotone" dataKey="alertas" name="Alertas" stroke="hsl(0 30% 50%)" fill="hsl(0 30% 50% / 0.12)" strokeWidth={2} />
                <Area type="monotone" dataKey="logins" name="Logins" stroke="hsl(215 25% 50%)" fill="hsl(215 25% 50% / 0.12)" strokeWidth={2} />
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

        {/* Word Cloud */}
        <WordCloudCard since={new Date(Date.now() - ({ "24h": 24, "7d": 168, "30d": 720, "6m": 4320, "12m": 8760 }[period] || 168) * 60 * 60 * 1000).toISOString()} />
      </div>
    </div>
  );
}
