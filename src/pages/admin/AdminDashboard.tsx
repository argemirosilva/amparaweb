import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, AlertTriangle, Clock, BarChart3, TrendingUp } from "lucide-react";
import GovKpiCard from "@/components/institucional/GovKpiCard";
import GovStatusBadge from "@/components/institucional/GovStatusBadge";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

export default function AdminDashboard() {
  const [period, setPeriod] = useState("30d");
  const [kpis, setKpis] = useState({
    monitoradas: 0,
    eventos: 0,
    emergencias: 0,
    tempoMedio: "—",
    reincidencia: "—",
  });

  useEffect(() => {
    async function load() {
      const periodMs = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[period] || 30;
      const since = new Date(Date.now() - periodMs * 24 * 60 * 60 * 1000).toISOString();

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
    load();
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
              {regions.map((r, i) => (
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
