// RIL API — leitura pública/admin de snapshots, eventos e métricas agregadas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "dashboard";

  // Helper: parse window param (número de dias ou "all")
  function parseWindow(raw: string | null): { days: number | "all"; label: string } {
    if (!raw || raw === "30") return { days: 30, label: "30d" };
    if (raw === "all") return { days: "all", label: "all" };
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return { days: n, label: `${n}d` };
    return { days: 30, label: "30d" };
  }

  try {
    if (action === "dashboard") {
      const { days, label } = parseWindow(url.searchParams.get("window"));

      // Tenta buscar métrica já computada para essa janela; se não houver, dispara cálculo on-demand
      let { data: latestMetric } = await supabase
        .from("ril_government_metrics")
        .select("*")
        .eq("scope_type", "nacional")
        .eq("scope_value", label)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestMetric) {
        // Compatibilidade: usa qualquer métrica nacional já gravada (legado sem scope_value)
        const { data: legacy } = await supabase
          .from("ril_government_metrics")
          .select("*")
          .eq("scope_type", "nacional")
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        latestMetric = legacy ?? null;
      }

      // Snapshots recentes (k-anonimizados: sem user_id)
      const { data: recentSnaps } = await supabase
        .from("risk_context_snapshots")
        .select(
          "computed_at, risco_ampara, risco_fonar, divergencia_entre_modelos, tendencia_risco, nivel_prioridade_intervencao, uf",
        )
        .order("computed_at", { ascending: false })
        .limit(500);

      // Eventos críticos recentes (sem identificação)
      const { data: criticalEvents } = await supabase
        .from("ril_events")
        .select("event_type, severity, payload, created_at")
        .eq("severity", "critical")
        .order("created_at", { ascending: false })
        .limit(50);

      // Série temporal da janela solicitada agregada por dia (paginada)
      const since = days === "all"
        ? new Date(0).toISOString()
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const PAGE = 1000;
      let from = 0;
      const timeline: Array<{ computed_at: string; risco_fonar: string; nivel_prioridade_intervencao: string }> = [];
      while (true) {
        const { data: chunk } = await supabase
          .from("risk_context_snapshots")
          .select("computed_at, risco_fonar, nivel_prioridade_intervencao")
          .gte("computed_at", since)
          .range(from, from + PAGE - 1);
        if (!chunk || chunk.length === 0) break;
        timeline.push(...chunk as any);
        if (chunk.length < PAGE) break;
        from += PAGE;
      }

      const dayMap = new Map<
        string,
        { total: number; urgente: number; grave: number }
      >();
      for (const s of timeline) {
        const day = (s.computed_at as string).slice(0, 10);
        const cur = dayMap.get(day) ?? { total: 0, urgente: 0, grave: 0 };
        cur.total++;
        if (s.nivel_prioridade_intervencao === "urgente") cur.urgente++;
        if (["grave", "extremo"].includes(s.risco_fonar as string)) cur.grave++;
        dayMap.set(day, cur);
      }
      const serie = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({ day, ...v }));

      return new Response(
        JSON.stringify({
          ok: true,
          window: label,
          metrics: latestMetric,
          serie_temporal: serie,
          critical_events: criticalEvents ?? [],
          snapshots_amostra: (recentSnaps ?? []).slice(0, 50),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "events") {
      const limit = Math.min(
        parseInt(url.searchParams.get("limit") ?? "100"),
        500,
      );
      const { data } = await supabase
        .from("ril_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return new Response(JSON.stringify({ ok: true, events: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "snapshot") {
      // Snapshot individual (uso institucional — exige user_id explícito)
      const userId = url.searchParams.get("user_id");
      if (!userId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data } = await supabase
        .from("risk_context_snapshots")
        .select("*")
        .eq("user_id", userId)
        .eq("latest", true)
        .maybeSingle();
      return new Response(JSON.stringify({ ok: true, snapshot: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "report") {
      const { label } = parseWindow(url.searchParams.get("window"));
      // Relatório executivo (texto técnico institucional) — busca métrica da janela
      let { data: m } = await supabase
        .from("ril_government_metrics")
        .select("*")
        .eq("scope_type", "nacional")
        .eq("scope_value", label)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!m) {
        const { data: legacy } = await supabase
          .from("ril_government_metrics")
          .select("*")
          .eq("scope_type", "nacional")
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        m = legacy ?? null;
      }

      if (!m) {
        return new Response(
          JSON.stringify({ ok: true, report: "Dados insuficientes." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const dist = m.distribuicao_risco as Record<string, number>;
      const corr = m.correlacao_ampara_fonar as Record<string, number>;
      const fatores = (m.fatores_mais_comuns as Array<{ fator: string; count: number }>) ?? [];

      const fatoresTxt = fatores.slice(0, 5).map((f) => f.fator).join(", ") ||
        "indefinidos";
      const totalFonar = (dist.moderado ?? 0) + (dist.grave ?? 0) +
        (dist.extremo ?? 0);
      const pctGrave = totalFonar > 0
        ? (((dist.grave ?? 0) + (dist.extremo ?? 0)) / totalFonar * 100).toFixed(
          1,
        )
        : "0.0";

      const report = [
        "## Relatório de Inteligência de Risco — Visão Nacional",
        `Período analisado: ${new Date(m.period_start).toLocaleDateString("pt-BR")} a ${new Date(m.period_end).toLocaleDateString("pt-BR")}.`,
        `Total de amostras consideradas: ${m.total_amostras} (k-anonymity mínimo: ${m.k_anonymity_min}).`,
        "",
        "### 1. Situação geral",
        `${pctGrave}% dos casos avaliados pelo FONAR encontram-se em risco grave ou extremo.`,
        `Convergência entre AMPARA e FONAR: ${corr.convergencia ?? 0} casos. Divergência: ${corr.divergencia ?? 0} casos.`,
        "",
        "### 2. Tendências",
        `Taxa de escalada de risco no período: ${((m.taxa_escalada ?? 0) * 100).toFixed(1)}%.`,
        `Taxa de recorrência de fatores críticos: ${((m.taxa_recorrencia ?? 0) * 100).toFixed(1)}%.`,
        "",
        "### 3. Principais fatores observados",
        fatoresTxt,
        "",
        "### 4. Indicadores de cobertura",
        `Taxa de atualização do FONAR: ${((m.taxa_atualizacao_fonar ?? 0) * 100).toFixed(1)}%.`,
        `Indicador de subnotificação indireta: ${((m.indicador_subnotificacao ?? 0) * 100).toFixed(1)}%.`,
        "",
        "### 5. Recomendações estratégicas",
        "- Priorizar acompanhamento institucional de casos com divergência entre modelos.",
        "- Reforçar campanhas para atualização do FONAR em territórios com alto indicador de subnotificação.",
        "- Avaliar políticas preventivas direcionadas aos fatores recorrentes acima.",
      ].join("\n");

      return new Response(JSON.stringify({ ok: true, report, metrics: m }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ril-api error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
