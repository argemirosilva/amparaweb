// RIL Engine — Risk Intelligence Layer
// Correlaciona risco_ampara x risco_fonar SEM mistura. Gera snapshots e eventos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- Helpers de normalização ---
const AMPARA_LEVELS: Record<string, number> = {
  sem_risco: 0,
  baixo: 0,
  moderado: 1,
  medio: 1,
  alto: 2,
  critico: 3,
};
const FONAR_LEVELS: Record<string, number> = {
  sem_risco: 0,
  baixo: 0,
  moderado: 1,
  grave: 2,
  alto: 2,
  extremo: 3,
  critico: 3,
};

function normAmpara(level?: string | null) {
  return AMPARA_LEVELS[(level ?? "sem_risco").toLowerCase()] ?? 0;
}
function normFonar(level?: string | null) {
  return FONAR_LEVELS[(level ?? "sem_risco").toLowerCase()] ?? 0;
}

function classifyPriority(amp: number, fon: number, panicked: boolean) {
  const max = Math.max(amp, fon);
  if (panicked || max >= 3) return "urgente";
  if (max === 2) return "alto";
  if (max === 1) return "medio";
  return "baixo";
}

function classifyConfidence(divergence: number, samples: number) {
  if (samples < 2) return "baixa";
  if (divergence === 0) return "alta";
  if (divergence === 1) return "media";
  return "baixa";
}

function buildRecommendation(args: {
  amparaLevel: string;
  fonarLevel: string;
  divergence: number;
  trend: string;
  panicked: boolean;
}) {
  const parts: string[] = [];
  if (args.panicked) {
    parts.push(
      "Acionamento de pânico recente. Recomenda-se acompanhamento prioritário e validação imediata da rede de proteção.",
    );
  }
  if (args.divergence >= 2) {
    parts.push(
      `Divergência expressiva entre AMPARA (${args.amparaLevel}) e FONAR (${args.fonarLevel}). Sugerir revisão do FONAR pela usuária e análise manual institucional.`,
    );
  } else if (args.divergence === 1) {
    parts.push(
      "Pequena divergência entre os modelos. Monitorar evolução nos próximos ciclos.",
    );
  } else {
    parts.push(
      "Convergência entre modelos: contexto consistente. Manter rotina de monitoramento.",
    );
  }
  if (args.trend === "subindo") {
    parts.push("Tendência de risco em elevação detectada.");
  } else if (args.trend === "descendo") {
    parts.push("Tendência de redução de risco observada.");
  }
  return parts.join(" ");
}

async function computeForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  origem: "cron" | "trigger" | "manual",
) {
  // 1) Risco AMPARA (último micro/macro)
  const { data: lastMicro } = await supabase
    .from("analysis_micro_results")
    .select("risk_level, cycle_phase, created_at, output_json")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lastMacro } = await supabase
    .from("analysis_macro_reports")
    .select("output_json, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2) Risco FONAR
  const { data: lastFonar } = await supabase
    .from("fonar_risk_assessments")
    .select("risk_level, risk_score, fatores, computed_at")
    .eq("user_id", userId)
    .eq("latest", true)
    .maybeSingle();

  // 3) Pânico recente (últimas 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentPanic } = await supabase
    .from("alertas_panico")
    .select("id, criado_em")
    .eq("user_id", userId)
    .gte("criado_em", since)
    .limit(1);

  // 4) Snapshots anteriores (tendência + recorrência)
  const { data: prevSnaps } = await supabase
    .from("risk_context_snapshots")
    .select(
      "risco_ampara_score, risco_fonar_score, computed_at, fatores_criticos_ativos",
    )
    .eq("user_id", userId)
    .order("computed_at", { ascending: false })
    .limit(5);

  const amparaLevel = (lastMicro?.risk_level ?? "sem_risco") as string;
  const fonarLevel = (lastFonar?.risk_level ?? "sem_risco") as string;
  const ampN = normAmpara(amparaLevel);
  const fonN = normFonar(fonarLevel);
  const ampScore = ampN * 33;
  const fonScore = (lastFonar?.risk_score as number | undefined) ?? fonN * 33;

  const divergence = Math.abs(ampN - fonN);
  const isDivergent = divergence >= 2;

  // Tendência
  let trend: "subindo" | "estavel" | "descendo" = "estavel";
  if (prevSnaps && prevSnaps.length >= 1) {
    const prev = prevSnaps[0];
    const prevMax = Math.max(
      prev.risco_ampara_score ?? 0,
      prev.risco_fonar_score ?? 0,
    );
    const currMax = Math.max(ampScore, fonScore);
    if (currMax - prevMax >= 15) trend = "subindo";
    else if (prevMax - currMax >= 15) trend = "descendo";
  }

  // Fatores críticos ativos
  const fatores: string[] = [];
  const microJson = (lastMicro?.output_json ?? {}) as Record<string, unknown>;
  const microRiskFactors = (microJson?.fatores_de_risco ?? microJson?.fatores ??
    []) as string[];
  if (Array.isArray(microRiskFactors)) fatores.push(...microRiskFactors);
  const fonarFatores = (lastFonar?.fatores ?? {}) as Record<string, unknown>;
  if (Array.isArray(fonarFatores?.principais)) {
    fatores.push(...(fonarFatores.principais as string[]));
  }
  const fatoresUnicos = Array.from(new Set(fatores)).slice(0, 10);

  // Recorrência (fatores que aparecem em snapshots anteriores)
  const reincidentes: string[] = [];
  if (prevSnaps) {
    const counts = new Map<string, number>();
    for (const s of prevSnaps) {
      const arr = (s.fatores_criticos_ativos ?? []) as string[];
      for (const f of arr) counts.set(f, (counts.get(f) ?? 0) + 1);
    }
    for (const f of fatoresUnicos) {
      if ((counts.get(f) ?? 0) >= 2) reincidentes.push(f);
    }
  }

  const panicked = (recentPanic?.length ?? 0) > 0;
  const priority = classifyPriority(ampN, fonN, panicked);
  const confidence = classifyConfidence(divergence, prevSnaps?.length ?? 0);
  const recomendacao = buildRecommendation({
    amparaLevel,
    fonarLevel,
    divergence,
    trend,
    panicked,
  });

  // 5) Marcar snapshots antigos como não-latest
  await supabase
    .from("risk_context_snapshots")
    .update({ latest: false })
    .eq("user_id", userId)
    .eq("latest", true);

  // 6) Inserir snapshot
  const { data: snap, error: snapErr } = await supabase
    .from("risk_context_snapshots")
    .insert({
      user_id: userId,
      risco_ampara: amparaLevel,
      risco_ampara_score: ampScore,
      risco_fonar: fonarLevel,
      risco_fonar_score: fonScore,
      divergencia_entre_modelos: isDivergent,
      divergencia_magnitude: divergence,
      tendencia_risco: trend,
      confiabilidade_contexto: confidence,
      fatores_criticos_ativos: fatoresUnicos,
      fatores_reincidentes: reincidentes,
      nivel_prioridade_intervencao: priority,
      recomendacao_acao: recomendacao,
      origem_evento: origem,
      latest: true,
    })
    .select()
    .single();

  if (snapErr) throw snapErr;

  // 7) Eventos derivados (explicáveis)
  const events: Array<{
    user_id: string;
    event_type: string;
    snapshot_id: string;
    severity: string;
    payload: Record<string, unknown>;
  }> = [
    {
      user_id: userId,
      event_type: "risk_context_created",
      snapshot_id: snap.id,
      severity: priority === "urgente" ? "critical" : "info",
      payload: { ampara: amparaLevel, fonar: fonarLevel, trend, priority },
    },
  ];

  if (isDivergent) {
    events.push({
      user_id: userId,
      event_type: "risk_divergence_detected",
      snapshot_id: snap.id,
      severity: "warning",
      payload: { magnitude: divergence, ampara: amparaLevel, fonar: fonarLevel },
    });
  }
  if (trend === "subindo" && Math.max(ampN, fonN) >= 2) {
    events.push({
      user_id: userId,
      event_type: "risk_escalation_detected",
      snapshot_id: snap.id,
      severity: "critical",
      payload: { trend, max_level: Math.max(ampN, fonN) },
    });
  }
  if (reincidentes.length >= 2) {
    events.push({
      user_id: userId,
      event_type: "risk_recurrence_detected",
      snapshot_id: snap.id,
      severity: "warning",
      payload: { reincidentes },
    });
  }
  if (priority === "urgente") {
    events.push({
      user_id: userId,
      event_type: "institutional_alert_generated",
      snapshot_id: snap.id,
      severity: "critical",
      payload: { recomendacao },
    });
  }

  await supabase.from("ril_events").insert(events);

  return snap;
}

// --- Indicadores agregados (Government Insights) ---
async function computeGovernmentMetrics(
  supabase: ReturnType<typeof createClient>,
  windowDays: number | "all" = 30,
) {
  const periodEnd = new Date();
  // windowDays === "all" → desde 1970 (toda a base)
  const periodStart = windowDays === "all"
    ? new Date(0)
    : new Date(periodEnd.getTime() - windowDays * 24 * 60 * 60 * 1000);

  let query = supabase
    .from("risk_context_snapshots")
    .select(
      "risco_ampara, risco_fonar, divergencia_entre_modelos, tendencia_risco, fatores_criticos_ativos, fatores_reincidentes, nivel_prioridade_intervencao, computed_at, user_id",
    )
    .lte("computed_at", periodEnd.toISOString());

  if (windowDays !== "all") {
    query = query.gte("computed_at", periodStart.toISOString());
  }
  // Paginação para ultrapassar limite default de 1000 do PostgREST
  const PAGE = 1000;
  let from = 0;
  let snaps: any[] = [];
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    snaps = snaps.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const total = snaps?.length ?? 0;
  const K_MIN = 5;

  if (total < K_MIN) {
    // k-anonymity: não publica série pequena
    await supabase.from("ril_government_metrics").insert({
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      scope_type: "nacional",
      total_amostras: total,
      k_anonymity_min: K_MIN,
      payload_extra: { suprimido_por_k_anonymity: true },
    });
    return { total, suppressed: true };
  }

  const distribuicao = { moderado: 0, grave: 0, extremo: 0 };
  let escaladas = 0;
  let convergencias = 0;
  let divergencias = 0;
  const fatoresMap = new Map<string, number>();
  let recorrentes = 0;
  const usersComSnapshot = new Set<string>();

  for (const s of snaps!) {
    usersComSnapshot.add(s.user_id as string);
    const fonScore = normFonar(s.risco_fonar as string);
    if (fonScore === 1) distribuicao.moderado++;
    if (fonScore === 2) distribuicao.grave++;
    if (fonScore === 3) distribuicao.extremo++;
    if (s.tendencia_risco === "subindo") escaladas++;
    if (s.divergencia_entre_modelos) divergencias++;
    else convergencias++;
    const arr = (s.fatores_criticos_ativos ?? []) as string[];
    for (const f of arr) fatoresMap.set(f, (fatoresMap.get(f) ?? 0) + 1);
    if ((s.fatores_reincidentes as string[])?.length >= 2) recorrentes++;
  }

  const fatoresMaisComuns = Array.from(fatoresMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([fator, count]) => ({ fator, count }));

  // Atualização FONAR: usuárias com fonar_submissions concluídas no período
  const { count: fonarUpdated } = await supabase
    .from("fonar_submissions")
    .select("id", { count: "exact", head: true })
    .gte("updated_at", periodStart.toISOString());

  const taxaAtualizacaoFonar = usersComSnapshot.size > 0
    ? (fonarUpdated ?? 0) / usersComSnapshot.size
    : 0;

  // Subnotificação: alto risco AMPARA mas fonar não atualizado
  const subnotificacao = snaps!.filter((s) =>
    normAmpara(s.risco_ampara as string) >= 2 &&
    normFonar(s.risco_fonar as string) === 0
  ).length / total;

  const metric = {
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    scope_type: "nacional",
    total_amostras: total,
    k_anonymity_min: K_MIN,
    distribuicao_risco: distribuicao,
    tendencia_temporal: { escaladas, total },
    taxa_escalada: total > 0 ? escaladas / total : 0,
    taxa_recorrencia: total > 0 ? recorrentes / total : 0,
    fatores_mais_comuns: fatoresMaisComuns,
    taxa_atualizacao_fonar: taxaAtualizacaoFonar,
    correlacao_ampara_fonar: { convergencia: convergencias, divergencia: divergencias },
    indicador_subnotificacao: subnotificacao,
  };

  await supabase.from("ril_government_metrics").insert(metric);
  return { total, metric };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Verifica feature flag
    const { data: settings } = await supabase
      .from("ril_settings")
      .select("valor")
      .eq("chave", "enabled")
      .maybeSingle();
    const enabled = (settings?.valor as unknown) === true;
    if (!enabled) {
      return new Response(JSON.stringify({ ok: true, disabled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ??
      (req.method === "POST" ? (await req.json().catch(() => ({}))).action : null) ??
      "consolidate";

    if (action === "compute_user") {
      const body = await req.json();
      const userId = body.user_id as string;
      const origem = (body.origem as "cron" | "trigger" | "manual") ?? "manual";
      if (!userId) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const snap = await computeForUser(supabase, userId, origem);
      return new Response(JSON.stringify({ ok: true, snapshot: snap }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "consolidate") {
      // Cron: processa usuárias com eventos pendentes nas últimas 6h
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: pendentes } = await supabase
        .from("ril_events")
        .select("user_id")
        .gte("created_at", since)
        .eq("event_type", "risk_recompute_requested")
        .not("user_id", "is", null);

      const uniqueUsers = Array.from(
        new Set((pendentes ?? []).map((p) => p.user_id as string)),
      );

      const results: unknown[] = [];
      for (const uid of uniqueUsers) {
        try {
          results.push(await computeForUser(supabase, uid, "cron"));
        } catch (e) {
          console.error("snapshot failed", uid, e);
        }
      }

      // Recalcular indicadores agregados
      const metrics = await computeGovernmentMetrics(supabase, 30);

      return new Response(
        JSON.stringify({ ok: true, processed: results.length, metrics }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "metrics") {
      const m = await computeGovernmentMetrics(supabase, 30);
      return new Response(JSON.stringify({ ok: true, ...m }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ril-engine error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
