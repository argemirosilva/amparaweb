import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============================================================
// CONSTANTS — configurable heuristic thresholds
// ============================================================
const HEURISTICS = {
  // Thresholds for auto-triggering MACRO
  CRITICO_W24_THRESHOLD: 1,
  ALTO_W72_THRESHOLD: 2,
  EXPLOSAO_W7_THRESHOLD: 2,
  CONSISTENTE_W7_THRESHOLD: 2,
  AMEACA_W7_THRESHOLD: 1,
  COERCAO_W7_THRESHOLD: 1,
  // Degradation detection
  EXPLOSAO_RATE_INCREASE: 0.30,
  ALTO_CRITICO_INCREASE: 0.25,
  // Safety nudge
  FISICA_WINDOW_DAYS: 30,
  SEXUAL_WINDOW_DAYS: 30,
};

const MICRO_PROMPT_VERSION = "micro_prompt_v2";
const MACRO_PROMPT_VERSION = "macro_prompt_v1";
const MICRO_MODEL = "google/gemini-3-flash-preview";
const MACRO_MODEL = "google/gemini-3-flash-preview";

// ============================================================
// HELPERS
// ============================================================
async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  return hashText(token);
}

async function authenticateSession(supabase: any, sessionToken: string) {
  if (!sessionToken) return null;
  const tokenHash = await hashToken(sessionToken);
  const { data } = await supabase
    .from("user_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  return data.user_id as string;
}

async function callAI(messages: any[], model: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

function parseAIJson(raw: string): any {
  let clean = raw.trim();
  if (clean.startsWith("```")) clean = clean.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const m = clean.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : clean);
}

async function getMicroPrompt(supabase: any): Promise<string> {
  const FALLBACK = `Você atuará como um 'Especialista em Análise Contextual de Relações Conjugais', com foco na interpretação semântica e comportamental de diálogos para identificar padrões de abuso e risco, mantendo equilíbrio e bom senso.

PRINCÍPIO DE BOM SENSO:
- O foco desta análise é a PROTEÇÃO DA MULHER. O sistema tem uma leve tendência a favor da vítima.
- Nem toda discordância é abuso, mas na dúvida, proteja a mulher.
- Somente aponte comportamentos inadequados da mulher quando forem MUITO CLAROS e evidentes.
- Desabafos, frustrações, cobranças e reações emocionais da mulher NÃO devem ser classificados como abuso.

Objetivo:
- Avaliar conversas de forma holística, indo além de frases isoladas.
- Identificar sinais REAIS de abuso psicológico, moral, físico, patrimonial ou sexual — com evidências claras.
- Diferenciar interações consensuais e conflitos normais de violência mascarada ou ameaças implícitas.
- Detectar TÁTICAS MANIPULATIVAS SUTIS que podem não parecer abuso direto mas são formas de controle.

Regras:
1) Análise Contextual: tom geral, desequilíbrios de poder, tentativas de controle, frequência de desqualificações.
2) Identificação de Escalada: aumento na intensidade, linguagem possessiva, transição de brincadeiras para intimidação.
3) Classificação: saudavel, rispido_nao_abusivo, potencial_abuso_leve, padrao_consistente_abuso, ameaca_risco, risco_elevado_escalada.
4) Extração de Xingamentos: TODOS os insultos direcionados à mulher. Normalize para minúsculas.
5) TÁTICAS MANIPULATIVAS: instrumentalizacao_filhos, falsa_demonstracao_afeto, ameaca_juridica_velada, acusacao_sem_evidencia, gaslighting, vitimizacao_reversa, controle_disfarçado_preocupacao.
6) ORIENTAÇÕES PARA A MULHER: alertas, sugestões de ação e frases de validação emocional personalizadas.
7) CICLO DE VIOLÊNCIA: identifique a fase atual (tensao, explosao, lua_de_mel, calmaria, nao_identificado), se há transição detectada e se há encurtamento do ciclo.

Retorne APENAS JSON válido (sem markdown, sem backticks):
{
  "resumo_contexto": "Descrição neutra e equilibrada (máx 200 palavras)",
  "analise_linguagem": [],
  "padroes_detectados": [],
  "tipos_violencia": ["fisica|psicologica|moral|patrimonial|sexual|nenhuma"],
  "nivel_risco": "sem_risco|moderado|alto|critico",
  "justificativa_risco": "...",
  "classificacao_contexto": "saudavel|rispido_nao_abusivo|potencial_abuso_leve|padrao_consistente_abuso|ameaca_risco|risco_elevado_escalada",
  "sentimento": "positivo|negativo|neutro|misto",
  "palavras_chave": [],
  "xingamentos": [],
  "categorias": ["violencia_fisica|violencia_psicologica|ameaca|coercao|controle|assedio|nenhuma"],
  "taticas_manipulativas": [{"tatica":"...","descricao":"...","evidencia":"...","gravidade":"baixa|media|alta"}],
  "orientacoes_vitima": ["Orientações práticas e acolhedoras personalizadas"],
  "sinais_alerta": ["sinais identificados"],
  "ciclo_violencia": {
    "fase_atual": "tensao|explosao|lua_de_mel|calmaria|nao_identificado",
    "transicao_detectada": false,
    "encurtamento_ciclo": false,
    "justificativa": "..."
  }
}

Se NÃO houver táticas/orientações/sinais, retorne arrays vazios.
Seja ESPECÍFICO nas evidências — cite trechos da transcrição.`;

  try {
    const { data } = await supabase
      .from("admin_settings").select("valor").eq("chave", "ia_prompt_analise").maybeSingle();
    return data?.valor?.trim() || FALLBACK;
  } catch { return FALLBACK; }
}

// ============================================================
// WORKER: MICRO
// ============================================================
async function runMicro(supabase: any, jobId: string, payload: any): Promise<any> {
  const { transcription_id, recording_id, user_id } = payload;

  // Get transcription text
  let transcricao: string | null = null;
  if (recording_id) {
    const { data } = await supabase.from("gravacoes").select("transcricao").eq("id", recording_id).maybeSingle();
    transcricao = data?.transcricao;
  }
  if (!transcricao) throw new Error("Transcrição não encontrada");

  const inputHash = await hashText(transcricao);

  // Idempotency check: same input_hash + same prompt_version for this recording
  const { data: existing } = await supabase
    .from("analysis_micro_results")
    .select("id")
    .eq("recording_id", recording_id)
    .eq("latest", true)
    .eq("input_hash", inputHash)
    .eq("prompt_version", MICRO_PROMPT_VERSION)
    .maybeSingle();

  if (existing) {
    console.log(`Idempotent skip: micro result ${existing.id} already exists for recording ${recording_id}`);
    return { skipped: true, result_id: existing.id };
  }

  // Run AI
  const systemPrompt = await getMicroPrompt(supabase);
  const raw = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Analise esta transcrição:\n\n${transcricao}` },
  ], MICRO_MODEL);

  let parsed: any;
  try {
    parsed = parseAIJson(raw);
  } catch {
    // Store error result
    await supabase.from("analysis_micro_results").insert({
      user_id, recording_id, transcription_id,
      prompt_version: MICRO_PROMPT_VERSION, model: MICRO_MODEL,
      input_hash: inputHash, output_json: { raw_response: raw.substring(0, 1000) },
      risk_level: "sem_risco", context_classification: "saudavel",
      cycle_phase: "nao_identificado", status: "error",
      error_message: "Failed to parse AI response", latest: false,
    });
    throw new Error("Failed to parse AI JSON");
  }

  const riskLevel = parsed.nivel_risco || "sem_risco";
  const contextClass = parsed.classificacao_contexto || "saudavel";
  const cyclePhase = parsed.ciclo_violencia?.fase_atual || "nao_identificado";

  // Transactional: set previous latest=false, insert new latest=true
  if (recording_id) {
    await supabase.from("analysis_micro_results")
      .update({ latest: false })
      .eq("recording_id", recording_id)
      .eq("latest", true);
  }
  if (transcription_id) {
    await supabase.from("analysis_micro_results")
      .update({ latest: false })
      .eq("transcription_id", transcription_id)
      .eq("latest", true);
  }

  const { data: inserted, error: insErr } = await supabase.from("analysis_micro_results").insert({
    user_id, recording_id, transcription_id,
    prompt_version: MICRO_PROMPT_VERSION, model: MICRO_MODEL,
    input_hash: inputHash, output_json: parsed,
    risk_level: riskLevel, context_classification: contextClass,
    cycle_phase: cyclePhase, status: "success", latest: true,
  }).select("id").single();

  if (insErr) throw new Error(`Insert error: ${insErr.message}`);

  // Also write to legacy gravacoes_analises for backward compat
  const { data: existingLegacy } = await supabase
    .from("gravacoes_analises").select("id").eq("gravacao_id", recording_id).maybeSingle();
  
  const legacyData = {
    gravacao_id: recording_id, user_id,
    resumo: parsed.resumo_contexto || "",
    sentimento: parsed.sentimento || "neutro",
    nivel_risco: riskLevel,
    categorias: parsed.categorias || [],
    palavras_chave: parsed.palavras_chave || [],
    xingamentos: parsed.xingamentos || [],
    analise_completa: parsed,
    modelo_usado: MICRO_MODEL,
  };

  if (existingLegacy) {
    await supabase.from("gravacoes_analises").update(legacyData).eq("id", existingLegacy.id);
  } else {
    await supabase.from("gravacoes_analises").insert(legacyData);
  }

  return { result_id: inserted.id, risk_level: riskLevel, cycle_phase: cyclePhase };
}

// ============================================================
// HEURISTICS
// ============================================================
async function computeHeuristics(supabase: any, userId: string, windowDays = 7) {
  const now = new Date();
  const w24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const w72 = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const w7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const w30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get all micro results for W7 (covers W24 and W72 too)
  const { data: w7Results } = await supabase
    .from("analysis_micro_results")
    .select("risk_level, context_classification, cycle_phase, output_json, created_at")
    .eq("user_id", userId).eq("latest", true).eq("status", "success")
    .gte("created_at", w7).order("created_at", { ascending: false });

  // Get W30 results for physical/sexual violence check
  const { data: w30Results } = await supabase
    .from("analysis_micro_results")
    .select("output_json")
    .eq("user_id", userId).eq("latest", true).eq("status", "success")
    .gte("created_at", w30);

  const results = w7Results || [];
  const total_w7 = results.length;

  // Compute counters
  let c_critico_w24 = 0, c_alto_w72 = 0, c_explosao_w7 = 0, c_consistente_w7 = 0;
  let c_ameaca_w7 = 0, c_coercao_w7 = 0, c_controle_w7 = 0, c_xingamentos_w7 = 0;
  let has_encurtamento_w7 = false;

  const consistentClasses = new Set(["padrao_consistente_abuso", "ameaca_risco", "risco_elevado_escalada"]);

  for (const r of results) {
    const created = new Date(r.created_at).getTime();
    if (r.risk_level === "critico" && created >= new Date(w24).getTime()) c_critico_w24++;
    if (r.risk_level === "alto" && created >= new Date(w72).getTime()) c_alto_w72++;
    if (r.cycle_phase === "explosao") c_explosao_w7++;
    if (consistentClasses.has(r.context_classification)) c_consistente_w7++;

    const oj = r.output_json as any;
    const cats = oj?.categorias || [];
    if (cats.includes("ameaca")) c_ameaca_w7++;
    if (cats.includes("coercao")) c_coercao_w7++;
    if (cats.includes("controle")) c_controle_w7++;
    c_xingamentos_w7 += (oj?.xingamentos || []).length;
    if (oj?.ciclo_violencia?.encurtamento_ciclo === true) has_encurtamento_w7 = true;
  }

  // W30 checks
  let has_violencia_fisica_w30 = false, has_sexual_w30 = false;
  for (const r of (w30Results || [])) {
    const oj = r.output_json as any;
    const tipos = oj?.tipos_violencia || [];
    if (tipos.includes("fisica")) has_violencia_fisica_w30 = true;
    if (tipos.includes("sexual")) has_sexual_w30 = true;
  }

  // Should trigger MACRO?
  const should_trigger_macro =
    c_critico_w24 >= HEURISTICS.CRITICO_W24_THRESHOLD ||
    c_alto_w72 >= HEURISTICS.ALTO_W72_THRESHOLD ||
    c_explosao_w7 >= HEURISTICS.EXPLOSAO_W7_THRESHOLD ||
    c_consistente_w7 >= HEURISTICS.CONSISTENTE_W7_THRESHOLD ||
    has_encurtamento_w7 ||
    c_ameaca_w7 >= HEURISTICS.AMEACA_W7_THRESHOLD ||
    c_coercao_w7 >= HEURISTICS.COERCAO_W7_THRESHOLD;

  // Safety nudge
  const lastResult = results[0];
  const needs_safety_nudge =
    (lastResult?.risk_level === "critico") ||
    has_violencia_fisica_w30 ||
    has_sexual_w30 ||
    c_ameaca_w7 >= 1;

  return {
    counters: {
      c_critico_w24, c_alto_w72, c_explosao_w7, c_consistente_w7,
      c_ameaca_w7, c_coercao_w7, c_controle_w7, c_xingamentos_w7,
      has_encurtamento_w7, has_violencia_fisica_w30, has_sexual_w30,
    },
    total_w7,
    should_trigger_macro,
    needs_safety_nudge,
    last_risk_level: lastResult?.risk_level || null,
    last_cycle_phase: lastResult?.cycle_phase || null,
  };
}

// ============================================================
// COMPUTE AGGREGATES (no raw text)
// ============================================================
async function computeAggregates(supabase: any, userId: string, windowDays: number) {
  const now = new Date();
  const start = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const { data: microResults } = await supabase
    .from("analysis_micro_results")
    .select("risk_level, context_classification, cycle_phase, output_json, created_at")
    .eq("user_id", userId).eq("latest", true).eq("status", "success")
    .gte("created_at", start.toISOString()).order("created_at", { ascending: true });

  const { data: alertas } = await supabase
    .from("alertas_panico")
    .select("id").eq("user_id", userId).gte("criado_em", start.toISOString());

  // Aggressor info
  const { data: vinculos } = await supabase
    .from("vitimas_agressores").select("agressor_id").eq("usuario_id", userId);
  let agressorInfo: any = {};
  if (vinculos?.length) {
    const { data: ag } = await supabase
      .from("agressores")
      .select("forca_seguranca, tem_arma_em_casa, flags, risk_level, risk_score")
      .eq("id", vinculos[0].agressor_id).maybeSingle();
    if (ag) agressorInfo = ag;
  }

  // Risk assessment
  const { data: riskData } = await supabase
    .from("risk_assessments")
    .select("risk_score, risk_level")
    .eq("usuario_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle();

  const results = microResults || [];
  const sentimentos: Record<string, number> = {};
  const tiposViolencia: Record<string, number> = {};
  const padroes: Record<string, number> = {};
  const palavras: Record<string, number> = {};
  const niveisRisco: Record<string, number> = {};
  const fasesCiclo: Record<string, number> = {};
  let transicoes = 0, encurtamento = false;

  for (const r of results) {
    const oj = r.output_json as any;
    // Sentimentos
    const sent = (oj?.sentimento || "neutro");
    sentimentos[sent] = (sentimentos[sent] || 0) + 1;
    // Tipos violencia
    for (const t of (oj?.tipos_violencia || [])) {
      if (t !== "nenhuma") tiposViolencia[t] = (tiposViolencia[t] || 0) + 1;
    }
    // Padroes
    for (const p of (oj?.padroes_detectados || [])) {
      const n = typeof p === "string" ? p : p?.padrao || "";
      if (n) padroes[n] = (padroes[n] || 0) + 1;
    }
    // Palavras
    for (const pw of (oj?.palavras_chave || [])) {
      palavras[pw] = (palavras[pw] || 0) + 1;
    }
    // Risk level
    niveisRisco[r.risk_level] = (niveisRisco[r.risk_level] || 0) + 1;
    // Cycle
    fasesCiclo[r.cycle_phase] = (fasesCiclo[r.cycle_phase] || 0) + 1;
    if (oj?.ciclo_violencia?.transicao_detectada) transicoes++;
    if (oj?.ciclo_violencia?.encurtamento_ciclo) encurtamento = true;
  }

  const topN = (obj: Record<string, number>, n: number) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ nome: k, contagem: v }));

  return {
    total_gravacoes_analisadas: results.length,
    alertas_panico: (alertas || []).length,
    distribuicao_sentimentos: sentimentos,
    tipos_violencia_detectados: topN(tiposViolencia, 10),
    padroes_recorrentes: topN(padroes, 10),
    palavras_chave_frequentes: topN(palavras, 15),
    niveis_risco_gravacoes: niveisRisco,
    informacoes_agressor: agressorInfo,
    ultimo_risk_score: riskData?.risk_score ?? null,
    ultimo_risk_level: riskData?.risk_level ?? null,
    distribuicao_fases_ciclo: fasesCiclo,
    transicoes_detectadas: transicoes,
    encurtamento_ciclo: encurtamento,
    window_start: start.toISOString(),
    window_end: now.toISOString(),
  };
}

// ============================================================
// WORKER: MACRO
// ============================================================
async function runMacro(supabase: any, jobId: string, payload: any): Promise<any> {
  const { user_id, window_days } = payload;
  const aggregates = await computeAggregates(supabase, user_id, window_days);

  if (aggregates.total_gravacoes_analisadas === 0) {
    return { skipped: true, reason: "No micro results in window" };
  }

  const macroPrompt = `Você é uma especialista em relações conjugais saudáveis, com experiência em psicologia de casais e assistência social. Com base nos dados agregados abaixo, gere um relatório humanizado sobre a saúde da relação desta mulher.

PRINCÍPIO FUNDAMENTAL:
O foco deste sistema é a PROTEÇÃO DA MULHER. Na dúvida, proteja-a.
- Desabafos, frustrações e reações emocionais da mulher são respostas esperadas.
- Promova diálogo e maturidade emocional, mas priorizando segurança.

DADOS AGREGADOS (últimos ${window_days} dias):
${JSON.stringify(aggregates, null, 2)}

INSTRUÇÕES:
1. "panorama_narrativo": 2-3 parágrafos acolhedores explicando a situação atual.
2. "explicacao_emocional": 2-3 frases sobre o que a distribuição de sentimentos significa.
3. "orientacoes": 3-5 orientações práticas e ESPECÍFICAS.
4. "canais_apoio": Canais relevantes (180, 190, Delegacia da Mulher).
5. "ciclo_violencia_resumo": Resumo das fases do ciclo identificadas no período.
6. "nivel_alerta": "baixo"|"moderado"|"alto"|"critico" baseado nos dados agregados.

RETORNE APENAS JSON válido:
{
  "panorama_narrativo": "texto...",
  "explicacao_emocional": "texto...",
  "orientacoes": [],
  "canais_apoio": [],
  "ciclo_violencia_resumo": "texto...",
  "nivel_alerta": "baixo|moderado|alto|critico"
}`;

  const raw = await callAI([{ role: "user", content: macroPrompt }], MACRO_MODEL);
  const parsed = parseAIJson(raw);

  const now = new Date();
  const windowStart = new Date(now.getTime() - window_days * 24 * 60 * 60 * 1000);

  // Set previous latest=false
  await supabase.from("analysis_macro_reports")
    .update({ latest: false })
    .eq("user_id", user_id).eq("window_days", window_days).eq("latest", true);

  const { data: inserted, error: insErr } = await supabase.from("analysis_macro_reports").insert({
    user_id, window_days,
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    prompt_version: MACRO_PROMPT_VERSION, model: MACRO_MODEL,
    aggregates_json: aggregates, output_json: parsed,
    status: "success", latest: true,
  }).select("id").single();

  if (insErr) throw new Error(`Insert macro error: ${insErr.message}`);
  return { result_id: inserted.id };
}

// ============================================================
// JOB PROCESSOR
// ============================================================
async function processJob(supabase: any, job: any) {
  // Mark running
  await supabase.from("analysis_jobs")
    .update({ status: "running", attempts: job.attempts + 1, updated_at: new Date().toISOString() })
    .eq("id", job.id);

  try {
    let result: any;
    if (job.job_type === "micro") {
      result = await runMicro(supabase, job.id, job.payload_json);
    } else if (job.job_type === "macro") {
      result = await runMacro(supabase, job.id, job.payload_json);
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    await supabase.from("analysis_jobs")
      .update({ status: "success", updated_at: new Date().toISOString() })
      .eq("id", job.id);

    // After micro success, check heuristics for auto-triggering macro
    if (job.job_type === "micro" && !result.skipped) {
      const userId = job.payload_json.user_id;
      const heuristics = await computeHeuristics(supabase, userId);
      if (heuristics.should_trigger_macro) {
        // Check if there's already a recent macro job queued/running
        const { data: existingMacro } = await supabase
          .from("analysis_jobs")
          .select("id")
          .eq("user_id", userId).eq("job_type", "macro")
          .in("status", ["queued", "running"])
          .maybeSingle();
        
        if (!existingMacro) {
          console.log(`Heuristics triggered MACRO for user ${userId}`);
          await supabase.from("analysis_jobs").insert({
            user_id: userId, job_type: "macro",
            payload_json: { user_id: userId, window_days: 7 },
            status: "queued",
          });
        }
      }
    }

    return result;
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`Job ${job.id} error:`, errMsg);
    await supabase.from("analysis_jobs")
      .update({ status: "error", last_error: errMsg, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    throw e;
  }
}

// ============================================================
// SERVE
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { action, session_token, ...params } = body;

    // Internal actions (called by other edge functions or cron)
    if (action === "processQueue") {
      // Process up to N queued jobs
      const limit = params.limit || 5;
      const { data: jobs } = await supabase
        .from("analysis_jobs")
        .select("*")
        .eq("status", "queued")
        .lte("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(limit);

      let processed = 0, errors = 0;
      for (const job of (jobs || [])) {
        try {
          await processJob(supabase, job);
          processed++;
        } catch {
          errors++;
        }
      }
      return json({ ok: true, processed, errors, total_queued: (jobs || []).length });
    }

    if (action === "enqueueMicro") {
      // Called from process-recording after transcription
      const { recording_id, user_id, transcription_id } = params;
      if (!recording_id || !user_id) return json({ error: "recording_id and user_id required" }, 400);

      const { data: job } = await supabase.from("analysis_jobs").insert({
        user_id, job_type: "micro",
        payload_json: { recording_id, user_id, transcription_id: transcription_id || null },
        status: "queued",
      }).select("id").single();

      // Process immediately (fire-and-forget for background)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/analysis-worker`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "processQueue", limit: 1 }),
      }).catch(e => console.error("Queue chain error:", e));

      return json({ ok: true, job_id: job?.id });
    }

    // Authenticated actions (via session token from web-api or direct)
    const userId = session_token ? await authenticateSession(supabase, session_token) : null;

    switch (action) {
      // POST /analysis/micro/run
      case "runMicro": {
        const targetUserId = params.user_id || userId;
        if (!targetUserId) return json({ error: "Sessão inválida" }, 401);
        const { recording_id, transcription_id } = params;
        if (!recording_id) return json({ error: "recording_id obrigatório" }, 400);

        // Verify ownership if regular user
        if (userId && userId === targetUserId) {
          const { data: grav } = await supabase.from("gravacoes").select("id").eq("id", recording_id).eq("user_id", userId).maybeSingle();
          if (!grav) return json({ error: "Gravação não encontrada" }, 404);
        }

        const { data: job } = await supabase.from("analysis_jobs").insert({
          user_id: targetUserId, job_type: "micro",
          payload_json: { recording_id, user_id: targetUserId, transcription_id },
          status: "queued",
        }).select("id").single();

        // Process immediately
        try {
          const { data: fullJob } = await supabase.from("analysis_jobs").select("*").eq("id", job!.id).single();
          const result = await processJob(supabase, fullJob);
          return json({ ok: true, job_id: job!.id, ...result });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Processing failed" }, 500);
        }
      }

      // GET /analysis/micro/latest
      case "getMicroLatest": {
        const targetUserId = params.user_id || userId;
        if (!targetUserId) return json({ error: "Sessão inválida" }, 401);
        const { recording_id, transcription_id } = params;

        let query = supabase.from("analysis_micro_results")
          .select("*").eq("user_id", targetUserId).eq("latest", true).eq("status", "success");
        if (recording_id) query = query.eq("recording_id", recording_id);
        if (transcription_id) query = query.eq("transcription_id", transcription_id);

        const { data } = await query.maybeSingle();
        return json({ ok: true, result: data || null });
      }

      // POST /analysis/macro/run
      case "runMacro": {
        const targetUserId = params.user_id || userId;
        if (!targetUserId) return json({ error: "Sessão inválida" }, 401);
        const windowDays = params.window_days || 7;
        if (![7, 14, 30].includes(windowDays)) return json({ error: "window_days deve ser 7, 14 ou 30" }, 400);

        const { data: job } = await supabase.from("analysis_jobs").insert({
          user_id: targetUserId, job_type: "macro",
          payload_json: { user_id: targetUserId, window_days: windowDays },
          status: "queued",
        }).select("id").single();

        try {
          const { data: fullJob } = await supabase.from("analysis_jobs").select("*").eq("id", job!.id).single();
          const result = await processJob(supabase, fullJob);
          return json({ ok: true, job_id: job!.id, ...result });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Processing failed" }, 500);
        }
      }

      // GET /analysis/macro/latest
      case "getMacroLatest": {
        const targetUserId = params.user_id || userId;
        if (!targetUserId) return json({ error: "Sessão inválida" }, 401);
        const windowDays = params.window_days || 7;

        const { data } = await supabase.from("analysis_macro_reports")
          .select("*").eq("user_id", targetUserId).eq("window_days", windowDays)
          .eq("latest", true).eq("status", "success").maybeSingle();

        return json({ ok: true, report: data || null });
      }

      // GET /analysis/heuristics/status
      case "getHeuristicsStatus": {
        const targetUserId = params.user_id || userId;
        if (!targetUserId) return json({ error: "Sessão inválida" }, 401);

        const heuristics = await computeHeuristics(supabase, targetUserId);
        // Strip sensitive data - only return flags
        return json({
          ok: true,
          should_trigger_macro: heuristics.should_trigger_macro,
          needs_safety_nudge: heuristics.needs_safety_nudge,
          last_risk_level: heuristics.last_risk_level,
          last_cycle_phase: heuristics.last_cycle_phase,
          total_analyses_w7: heuristics.total_w7,
        });
      }

      // GET jobs status
      case "getJobs": {
        const targetUserId = params.user_id || userId;
        if (!targetUserId) return json({ error: "Sessão inválida" }, 401);

        const { data } = await supabase.from("analysis_jobs")
          .select("id, job_type, status, attempts, created_at, updated_at, last_error")
          .eq("user_id", targetUserId)
          .order("created_at", { ascending: false })
          .limit(params.limit || 20);

        return json({ ok: true, jobs: data || [] });
      }

      default:
        return json({ error: `Action desconhecida: ${action}` }, 400);
    }
  } catch (err) {
    console.error("analysis-worker error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
