import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, AlertTriangle, Clock, BarChart3, TrendingUp } from "lucide-react";
import GovKpiCard from "@/components/institucional/GovKpiCard";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const PIE_COLORS = [
  "hsl(142 64% 34%)",   // baixo - green
  "hsl(45 93% 47%)",    // moderado - yellow
  "hsl(25 95% 53%)",    // alto - orange
  "hsl(0 73% 42%)",     // critico - red
  "hsl(220 9% 70%)",    // sem risco
];

const RISK_LABELS: Record<string, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
  sem_risco: "Sem risco",
};

export default function AdminDashboard() {
  const [period, setPeriod] = useState("30d");
  const [kpis, setKpis] = useState({
    monitoradas: 0,
    eventos: 0,
    emergencias: 0,
    tempoMedio: "—",
    reincidencia: "—",
  });
  const [timelineData, setTimelineData] = useState<{ date: string; eventos: number; emergencias: number }[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const periodDays = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[period] || 30;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    async function loadKpis() {
      const [{ count: monitoradas }, { count: eventos }, { count: emergencias }] = await Promise.all([
        supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("gravacoes_analises").select("*", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("alertas_panico").select("*", { count: "exact", head: true }).gte("criado_em", since),
      ]);
      setKpis({
        monitoradas: monitoradas || 0,
        eventos: eventos || 0,
        emergencias: emergencias || 0,
        tempoMedio: "2m 47s",
        reincidencia: "18%",
      });
    }

    async function loadTimeline() {
      const [{ data: eventosData }, { data: panicData }] = await Promise.all([
        supabase.from("gravacoes_analises").select("created_at").gte("created_at", since),
        supabase.from("alertas_panico").select("criado_em").gte("criado_em", since),
      ]);

      // Build day buckets
      const buckets: Record<string, { eventos: number; emergencias: number }> = {};
      for (let i = 0; i < periodDays; i++) {
        const key = format(subDays(new Date(), i), "yyyy-MM-dd");
        buckets[key] = { eventos: 0, emergencias: 0 };
      }
      (eventosData || []).forEach((e) => {
        const key = format(new Date(e.created_at), "yyyy-MM-dd");
        if (buckets[key]) buckets[key].eventos++;
      });
      (panicData || []).forEach((e) => {
        const key = format(new Date(e.criado_em), "yyyy-MM-dd");
        if (buckets[key]) buckets[key].emergencias++;
      });

      const sorted = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date: format(new Date(date), periodDays <= 30 ? "dd/MM" : "MM/yy", { locale: ptBR }),
          ...v,
        }));
      setTimelineData(sorted);
    }

    async function loadRiskDistribution() {
      const { data } = await supabase
        .from("gravacoes_analises")
        .select("nivel_risco")
        .gte("created_at", since);

      const counts: Record<string, number> = {};
      (data || []).forEach((r) => {
        const key = r.nivel_risco || "sem_risco";
        counts[key] = (counts[key] || 0) + 1;
      });
      setRiskDistribution(
        Object.entries(counts).map(([key, value]) => ({
          name: RISK_LABELS[key] || key,
          value,
        }))
      );
    }

    loadKpis();
    loadTimeline();
    loadRiskDistribution();
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
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>
          Admin &gt; Dashboard
        </p>
        <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
          Dashboard Institucional
        </h1>
        <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>
          Visão agregada por órgão e período
        </p>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-md border"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <span className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Período:</span>
        {["7d", "30d", "90d", "12m"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-3 py-1 text-xs rounded border transition-colors"
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <GovKpiCard title="Monitoradas Ativas" value={kpis.monitoradas} icon={Users} />
        <GovKpiCard title="Eventos no Período" value={kpis.eventos} icon={BarChart3} />
        <GovKpiCard title="Emergências" value={kpis.emergencias} icon={AlertTriangle} />
        <GovKpiCard title="Tempo Médio Resposta" value={kpis.tempoMedio} icon={Clock} />
        <GovKpiCard
          title="Taxa Reincidência"
          value={kpis.reincidencia}
          icon={TrendingUp}
          trend={{ value: "vs. período anterior", positive: false }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Timeline Chart */}
        <div
          className="lg:col-span-2 rounded-md border p-4"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "hsl(220 13% 18%)" }}>
            Evolução Temporal — Eventos e Emergências
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }}
                  interval={timelineData.length > 60 ? Math.floor(timelineData.length / 12) : "preserveStartEnd"}
                />
                <YAxis tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid hsl(220 13% 91%)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="eventos"
                  name="Eventos"
                  stroke="hsl(224 76% 48%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="emergencias"
                  name="Emergências"
                  stroke="hsl(0 73% 42%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {timelineData.length === 0 && (
            <p className="text-center text-xs mt-2" style={{ color: "hsl(220 9% 46%)" }}>
              Nenhum dado no período selecionado
            </p>
          )}
        </div>

        {/* Risk Distribution Pie */}
        <div
          className="rounded-md border p-4"
          style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "hsl(220 13% 18%)" }}>
            Distribuição por Nível de Risco
          </h2>
          <div className="h-64">
            {riskDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistribution}
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    style={{ fontSize: 11 }}
                  >
                    {riskDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      borderRadius: 6,
                      border: "1px solid hsl(220 13% 91%)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: "Inter, sans-serif" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                  Nenhum dado no período
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-md border overflow-hidden"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: "hsl(220 13% 91%)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "hsl(220 13% 18%)" }}>
            Regiões com maior incidência
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "hsl(210 17% 96%)" }}>
                {["Região", "Total Eventos", "Emergências", "Tendência", "Ação"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold"
                    style={{ color: "hsl(220 9% 46%)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => (
                <tr
                  key={r.nome}
                  className="border-t"
                  style={{ borderColor: "hsl(220 13% 91%)" }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                    {r.nome}
                  </td>
                  <td className="px-4 py-3" style={{ color: "hsl(220 13% 18%)" }}>{r.eventos}</td>
                  <td className="px-4 py-3" style={{ color: "hsl(220 13% 18%)" }}>{r.emergencias}</td>
                  <td className="px-4 py-3">
                    <GovStatusBadge
                      status={r.tendencia === "subindo" ? "vermelho" : r.tendencia === "descendo" ? "verde" : "amarelo"}
                      label={r.tendencia.charAt(0).toUpperCase() + r.tendencia.slice(1)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="text-xs font-medium px-3 py-1 rounded border transition-colors hover:bg-gray-50"
                      style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
                    >
                      Detalhar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          className="px-4 py-3 border-t text-xs"
          style={{ borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}
        >
          Dados agregados. Visualizações detalhadas são auditadas.
        </div>
      </div>
    </div>
  );
}