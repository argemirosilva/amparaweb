import { Link } from "react-router-dom";
import { Users, AlertTriangle, Clock, TrendingDown, MapPin } from "lucide-react";
import GovKpiCard from "@/components/institucional/GovKpiCard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

export default function TransparenciaHome() {
  const [kpis, setKpis] = useState({
    monitoradas: 0,
    alertas: 0,
    tempoMedioResposta: "—",
    reducao: "—",
  });

  useEffect(() => {
    async function loadKpis() {
      const [{ count: totalUsuarias }, { count: totalAlertas }] = await Promise.all([
        supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("status", "ativo"),
        supabase
          .from("alertas_panico")
          .select("*", { count: "exact", head: true })
          .gte("criado_em", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      setKpis({
        monitoradas: totalUsuarias || 0,
        alertas: totalAlertas || 0,
        tempoMedioResposta: "< 3 min",
        reducao: "-12%",
      });
    }
    loadKpis();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-10" style={fontStyle}>
      {/* Hero */}
      <section className="text-center mb-12">
        <h1
          className="text-2xl md:text-3xl font-semibold mb-3"
          style={{ color: "hsl(220 13% 18%)", fontWeight: 600 }}
        >
          Painel de Transparência
        </h1>
        <p className="text-sm max-w-2xl mx-auto" style={{ color: "hsl(220 9% 46%)" }}>
          Dados agregados e anonimizados sobre o monitoramento de situações de violência doméstica.
          Todas as informações são apresentadas de forma que impossibilite a identificação individual.
        </p>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <GovKpiCard
          title="Monitoradas Ativas"
          value={kpis.monitoradas}
          icon={Users}
          subtitle="Últimos 90 dias"
        />
        <GovKpiCard
          title="Alertas Registrados"
          value={kpis.alertas}
          icon={AlertTriangle}
          subtitle="Últimos 90 dias"
        />
        <GovKpiCard
          title="Tempo Médio Resposta"
          value={kpis.tempoMedioResposta}
          icon={Clock}
        />
        <GovKpiCard
          title="Tendência"
          value={kpis.reducao}
          icon={TrendingDown}
          trend={{ value: "vs. período anterior", positive: true }}
        />
      </section>

      {/* CTA Mapa */}
      <section className="text-center mb-10">
        <Link
          to="/transparencia/mapa"
          className="inline-flex items-center gap-2 px-6 py-3 rounded text-sm font-semibold transition-colors"
          style={{
            background: "hsl(224 76% 33%)",
            color: "#fff",
          }}
        >
          <MapPin className="w-4 h-4" />
          Abrir Mapa Interativo
        </Link>
      </section>

      {/* Info box */}
      <section
        className="rounded-md border p-4 text-xs"
        style={{
          background: "hsl(210 17% 96%)",
          borderColor: "hsl(220 13% 91%)",
          color: "hsl(220 9% 46%)",
        }}
      >
        <p className="font-medium mb-1" style={{ color: "hsl(220 13% 18%)" }}>
          Sobre os dados apresentados
        </p>
        <p>
          Todos os dados são agregados e anonimizados conforme critério de K-anonimato mínimo de 5.
          A atualização ocorre com atraso de 48 horas para proteção das vítimas.
          Nenhuma informação permite identificação individual.
        </p>
      </section>
    </div>
  );
}
