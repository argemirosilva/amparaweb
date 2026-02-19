import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, AlertTriangle, BarChart3, Smartphone } from "lucide-react";
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

const PIE_COLORS = [
  "hsl(142 64% 34%)",
  "hsl(45 93% 47%)",
  "hsl(25 95% 53%)",
  "hsl(0 73% 42%)",
  "hsl(220 9% 70%)",
];

const BAR_COLORS = [
  "hsl(224 76% 48%)",
  "hsl(262 60% 50%)",
  "hsl(316 72% 48%)",
  "hsl(190 80% 42%)",
  "hsl(142 64% 34%)",
  "hsl(45 93% 47%)",
  "hsl(25 95% 53%)",
  "hsl(0 73% 42%)",
  "hsl(280 55% 40%)",
  "hsl(200 70% 50%)",
  "hsl(160 60% 40%)",
  "hsl(340 65% 47%)",
];

const RISK_LABELS: Record<string, string> = {
  baixo: "Baixo", moderado: "Moderado", alto: "Alto", critico: "Crítico", sem_risco: "Sem risco",
};


const ACIONAMENTO_LABELS: Record<string, string> = {
  app: "Aplicativo", botao_fisico: "Botão", botao_manual: "Botão", botao: "Botão", automatico: "Automático",
};

const cardStyle = {
  background: "hsl(0 0% 100%)",
  borderColor: "hsl(220 13% 91%)",
};

const titleStyle = { color: "hsl(220 13% 18%)" };
const subtitleStyle = { color: "hsl(220 9% 46%)" };

const tooltipStyle = {
  fontFamily: "Inter, sans-serif",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid hsl(220 13% 91%)",
};

export default function AdminDashboard() {
  const [period, setPeriod] = useState("30d");
  const [kpis, setKpis] = useState({
    monitoradas: 0, eventos: 0, emergencias: 0,
    dispositivosOnline: 0,
  });
  const [timelineData, setTimelineData] = useState<{ date: string; eventos: number; emergencias: number }[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<{ name: string; value: number }[]>([]);
  const [ufData, setUfData] = useState<{ uf: string; total: number }[]>([]);
  
  const [acionamentoData, setAcionamentoData] = useState<{ name: string; value: number }[]>([]);
  const [hourlyData, setHourlyData] = useState<{ hora: string; alertas: number; logins: number }[]>([]);
  

  useEffect(() => {
    const periodDays = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[period] || 30;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    async function loadAll() {
      const [
        { count: monitoradas },
        { count: eventos },
        { count: emergencias },
        { data: deviceData },
        
        { data: eventosData },
        { data: panicData },
        { data: riskData },
        { data: usersData },
        { data: auditData },
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
      ]);

      const onlineCount = (deviceData || []).filter(d => d.status === "online").length;

      // KPIs
      setKpis({
        monitoradas: monitoradas || 0,
        eventos: eventos || 0,
        emergencias: emergencias || 0,
        dispositivosOnline: onlineCount,
      });

      // Timeline
      const buckets: Record<string, { eventos: number; emergencias: number }> = {};
      for (let i = 0; i < periodDays; i++) {
        buckets[format(subDays(new Date(), i), "yyyy-MM-dd")] = { eventos: 0, emergencias: 0 };
      }
      (eventosData || []).forEach(e => {
        const k = format(new Date(e.created_at), "yyyy-MM-dd");
        if (buckets[k]) buckets[k].eventos++;
      });
      (panicData || []).forEach(e => {
        const k = format(new Date(e.criado_em), "yyyy-MM-dd");
        if (buckets[k]) buckets[k].emergencias++;
      });
      setTimelineData(
        Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
          date: format(new Date(date), periodDays <= 30 ? "dd/MM" : "MM/yy", { locale: ptBR }),
          ...v,
        }))
      );

      // Risk distribution
      const riskCounts: Record<string, number> = {};
      (riskData || []).forEach(r => { const k = r.nivel_risco || "sem_risco"; riskCounts[k] = (riskCounts[k] || 0) + 1; });
      setRiskDistribution(Object.entries(riskCounts).map(([k, v]) => ({ name: RISK_LABELS[k] || k, value: v })));

      // Users by UF
      const ufCounts: Record<string, number> = {};
      (usersData || []).forEach(u => { const uf = u.endereco_uf || "N/I"; ufCounts[uf] = (ufCounts[uf] || 0) + 1; });
      setUfData(
        Object.entries(ufCounts).map(([uf, total]) => ({ uf, total })).sort((a, b) => b.total - a.total).slice(0, 12)
      );


      // Acionamento type (group botao_fisico + botao_manual as "Botão")
      const acCounts: Record<string, number> = {};
      (panicData || []).forEach(a => {
        const t = a.tipo_acionamento || "desconhecido";
        const label = ACIONAMENTO_LABELS[t] || t;
        acCounts[label] = (acCounts[label] || 0) + 1;
      });
      setAcionamentoData(
        Object.entries(acCounts).map(([name, value]) => ({ name, value }))
      );

      // Hourly activity
      const hourBuckets: Record<number, { alertas: number; logins: number }> = {};
      for (let h = 0; h < 24; h++) hourBuckets[h] = { alertas: 0, logins: 0 };
      (panicData || []).forEach(a => { const h = new Date(a.criado_em).getHours(); hourBuckets[h].alertas++; });
      (auditData || []).filter(a => a.action_type === "login" && a.success).forEach(a => {
        const h = new Date(a.created_at).getHours(); hourBuckets[h].logins++;
      });
      setHourlyData(
        Object.entries(hourBuckets).map(([h, v]) => ({ hora: `${h.padStart(2, "0")}h`, ...v }))
      );

    }

    loadAll();
  }, [period]);

  const regions = [
    { nome: "Porto Velho", eventos: 45, emergencias: 8, tendencia: "subindo" as const },
    { nome: "Ji-Paraná", eventos: 32, emergencias: 5, tendencia: "estável" as const },
    { nome: "Ariquemes", eventos: 21, emergencias: 3, tendencia: "descendo" as const },
    { nome: "Vilhena", eventos: 18, emergencias: 2, tendencia: "estável" as const },
  ];

  return (
    <div style={fontStyle}>
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs mb-1" style={subtitleStyle}>Admin &gt; Dashboard</p>
        <h1 className="text-xl font-semibold" style={titleStyle}>Dashboard</h1>
        <p className="text-sm" style={subtitleStyle}>Visão agregada por órgão e período</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-md border" style={cardStyle}>
        <span className="text-xs font-medium" style={subtitleStyle}>Período:</span>
        {["7d", "30d", "90d", "12m"].map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className="px-3 py-1 text-xs rounded border transition-colors"
            style={{
              borderColor: period === p ? "hsl(224 76% 33%)" : "hsl(220 13% 91%)",
              background: period === p ? "hsl(224 76% 33%)" : "transparent",
              color: period === p ? "#fff" : "hsl(220 9% 46%)",
              fontWeight: period === p ? 600 : 400,
            }}
          >{p}</button>
        ))}
      </div>

      {/* Visão Geral: Map + KPIs */}
      <div className="rounded-md border p-4 mb-8" style={cardStyle}>
        <h2 className="text-sm font-semibold mb-4" style={titleStyle}>Visão Geral</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <GovKpiCard title="Monitoradas Ativas" value={kpis.monitoradas} icon={Users} />
          <GovKpiCard title="Eventos no Período" value={kpis.eventos} icon={BarChart3} />
          <GovKpiCard title="Emergências" value={kpis.emergencias} icon={AlertTriangle} />
          <GovKpiCard title="Dispositivos Online" value={kpis.dispositivosOnline} icon={Smartphone} />
        </div>
        
      </div>

      {/* Row 1: Timeline + Risk Pie */}
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

      {/* Row 2: Alert Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Alert by type */}
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

      {/* Row 3: Hourly Activity */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        {/* Hourly activity */}
        <div className="rounded-md border p-4" style={cardStyle}>
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
      </div>

      {/* Row 4: Regions Table */}
      <div className="rounded-md border overflow-hidden" style={cardStyle}>
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

      {/* Row 5: Users by UF */}
      <div className="rounded-md border p-4 mt-6" style={cardStyle}>
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
  );
}
