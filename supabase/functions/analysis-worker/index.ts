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
const MACRO_PROMPT_VERSION = "macro_prompt_v2";
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

import { buildAnalysisPrompt, normalizeAnalysisOutput, buildTriagePrompt, buildMacroPrompt } from "../_shared/buildAnalysisPrompt.ts";

// ============================================================
// WORKER: MICRO
// ============================================================
async function runMicro(supabase: any, jobId: string, payload: any): Promise<any> {
  const { transcription_id, recording_id, user_id, import_id, chat_text } = payload;

  // Get transcription text — from chat_text (WhatsApp import) or recording
  let transcricao: string | null = chat_text || null;
  if (!transcricao && recording_id) {
    const { data } = await supabase.from("gravacoes").select("transcricao").eq("id", recording_id).maybeSingle();
    transcricao = data?.transcricao;
  }
  if (!transcricao) throw new Error("Transcrição não encontrada");

  const inputHash = await hashText(transcricao);

  // Idempotency check
  if (recording_id) {
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
  }

  // ── FAST TRIAGE PRE-FILTER ──
  // Skip full analysis for safe/silent recordings
  if (recording_id && !import_id) {
    try {
      const triagePrompt = await buildTriagePrompt(supabase);
      const triageRaw = await callAI([
        { role: "system", content: triagePrompt },
        { role: "user", content: transcricao },
      ], "google/gemini-2.5-flash-lite");

      let triageParsed: any = null;
      try { triageParsed = parseAIJson(triageRaw); } catch { /* ignore */ }
      const resultado = triageParsed?.resultado || triageParsed?.nivel_risco;

      if (resultado === "seguro") {
        console.log(`[MICRO] Triage classified as "seguro" for recording ${recording_id} — skipping full analysis`);

        // Save minimal result
        if (recording_id) {
          await supabase.from("analysis_micro_results")
            .update({ latest: false })
            .eq("recording_id", recording_id).eq("latest", true);
        }

        const safeOutput = {
          resumo_contexto: triageParsed?.motivo || "Conversa sem indicadores de risco identificados.",
          tipos_violencia: ["nenhuma"],
          nivel_risco: "sem_risco",
          classificacao_contexto: "saudavel",
          sentimento: "neutro",
          palavras_chave: [],
          xingamentos: [],
          categorias: ["nenhuma"],
          taticas_manipulativas: [],
          orientacoes_vitima: [],
          sinais_alerta: [],
          ciclo_violencia: { fase_atual: "nao_identificado", transicao_detectada: false, encurtamento_ciclo: false, justificativa: "Sem indicadores de risco." },
          analise_linguagem: [],
          padroes_detectados: [],
          _triage_skip: true,
        };

        const { data: inserted } = await supabase.from("analysis_micro_results").insert({
          user_id, recording_id, transcription_id: transcription_id || null,
          prompt_version: MICRO_PROMPT_VERSION, model: "triage-skip/gemini-2.5-flash-lite",
          input_hash: inputHash, output_json: safeOutput,
          risk_level: "sem_risco", context_classification: "saudavel",
          cycle_phase: "nao_identificado", status: "success", latest: true,
        }).select("id").single();

        // Legacy table
        const { data: existingLegacy } = await supabase
          .from("gravacoes_analises").select("id").eq("gravacao_id", recording_id).maybeSingle();
        const legacyData = {
          gravacao_id: recording_id, user_id,
          resumo: safeOutput.resumo_contexto, sentimento: "neutro",
          nivel_risco: "sem_risco", categorias: ["nenhuma"],
          palavras_chave: [], xingamentos: [],
          analise_completa: safeOutput, modelo_usado: "triage-skip/gemini-2.5-flash-lite",
        };
        if (existingLegacy) await supabase.from("gravacoes_analises").update(legacyData).eq("id", existingLegacy.id);
        else await supabase.from("gravacoes_analises").insert(legacyData);

        return { result_id: inserted?.id, risk_level: "sem_risco", triage_skipped: true };
      }
      console.log(`[MICRO] Triage classified as "${resultado}" — proceeding with full analysis`);
    } catch (e) {
      console.warn("[MICRO] Triage pre-filter failed, proceeding with full analysis:", e);
    }
  }

  // Run full AI analysis
  const systemPrompt = await buildAnalysisPrompt(supabase);
  const userPromptPrefix = import_id
    ? `Analise esta conversa do WhatsApp (contato: ${payload.contact_label || "parceiro"}):\n\n`
    : `Analise esta transcrição:\n\n`;
  const raw = await callAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: `${userPromptPrefix}${transcricao}` },
  ], MICRO_MODEL);

  let parsed: any;
  try {
    parsed = parseAIJson(raw);
    parsed = normalizeAnalysisOutput(parsed);
  } catch {
    await supabase.from("analysis_micro_results").insert({
      user_id, recording_id: recording_id || null, transcription_id: transcription_id || null,
      import_id: import_id || null,
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
    user_id, recording_id: recording_id || null, transcription_id: transcription_id || null,
    import_id: import_id || null,
    prompt_version: MICRO_PROMPT_VERSION, model: MICRO_MODEL,
    input_hash: inputHash, output_json: parsed,
    risk_level: riskLevel, context_classification: contextClass,
    cycle_phase: cyclePhase, status: "success", latest: true,
  }).select("id").single();

  if (insErr) throw new Error(`Insert error: ${insErr.message}`);

  // Write to legacy gravacoes_analises ONLY for recording-based analyses (not WhatsApp imports)
  if (recording_id) {
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
  }

  // Update WhatsApp import progress if applicable
  if (import_id) {
    const { data: analyzedCount } = await supabase
      .from("analysis_micro_results")
      .select("id")
      .eq("import_id", import_id)
      .eq("status", "success");

    const count = (analyzedCount || []).length;
    const { data: imp } = await supabase.from("whatsapp_imports")
      .select("total_chunks").eq("id", import_id).maybeSingle();

    await supabase.from("whatsapp_imports").update({
      analyzed_chunks: count,
      status: count >= (imp?.total_chunks || 0) ? "done" : "processing",
    }).eq("id", import_id);
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

  // New micro results
  const { data: microResults } = await supabase
    .from("analysis_micro_results")
    .select("risk_level, context_classification, cycle_phase, output_json, created_at, recording_id")
    .eq("user_id", userId).eq("latest", true).eq("status", "success")
    .gte("created_at", start.toISOString()).order("created_at", { ascending: true });

  // Legacy analyses (gravacoes_analises) — include recordings NOT already covered by micro
  const microRecIds = new Set((microResults || []).map((r: any) => r.recording_id).filter(Boolean));
  const { data: legacyAnalyses } = await supabase
    .from("gravacoes_analises")
    .select("gravacao_id, nivel_risco, sentimento, categorias, xingamentos, palavras_chave, resumo, analise_completa, created_at")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: true });

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
      .select("forca_seguranca, tem_arma_em_casa, flags, risk_level, risk_score, xingamentos_frequentes")
      .eq("id", vinculos[0].agressor_id).maybeSingle();
    if (ag) agressorInfo = ag;
  }

  // Risk assessment
  const { data: riskData } = await supabase
    .from("risk_assessments")
    .select("risk_score, risk_level")
    .eq("usuario_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle();

  const sentimentos: Record<string, number> = {};
  const tiposViolencia: Record<string, number> = {};
  const padroes: Record<string, number> = {};
  const palavras: Record<string, number> = {};
  const niveisRisco: Record<string, number> = {};
  const fasesCiclo: Record<string, number> = {};
  const xingamentos: Record<string, number> = {};
  let transicoes = 0, encurtamento = false;
  let totalAnalyzed = 0;

  // Build per-recording summaries for AI to reference
  const gravacoes_resumos: { id: string; data: string; risco: string; resumo: string }[] = [];

  // Process new micro results
  for (const r of (microResults || [])) {
    totalAnalyzed++;
    const oj = r.output_json as any;
    const sent = (oj?.sentimento || "neutro");
    sentimentos[sent] = (sentimentos[sent] || 0) + 1;
    for (const t of (oj?.tipos_violencia || [])) {
      if (t !== "nenhuma") tiposViolencia[t] = (tiposViolencia[t] || 0) + 1;
    }
    for (const p of (oj?.padroes_detectados || [])) {
      const n = typeof p === "string" ? p : p?.padrao || "";
      if (n) padroes[n] = (padroes[n] || 0) + 1;
    }
    for (const pw of (oj?.palavras_chave || [])) {
      palavras[pw] = (palavras[pw] || 0) + 1;
    }
    for (const x of (oj?.xingamentos || [])) {
      xingamentos[x] = (xingamentos[x] || 0) + 1;
    }
    niveisRisco[r.risk_level] = (niveisRisco[r.risk_level] || 0) + 1;
    fasesCiclo[r.cycle_phase] = (fasesCiclo[r.cycle_phase] || 0) + 1;
    if (oj?.ciclo_violencia?.transicao_detectada) transicoes++;
    if (oj?.ciclo_violencia?.encurtamento_ciclo) encurtamento = true;
  }

  // Process legacy analyses (not already covered by micro)
  for (const la of (legacyAnalyses || [])) {
    if (microRecIds.has(la.gravacao_id)) continue; // skip duplicates
    totalAnalyzed++;
    const sent = la.sentimento || "neutro";
    sentimentos[sent] = (sentimentos[sent] || 0) + 1;
    for (const cat of (la.categorias || [])) {
      if (cat !== "nenhuma") tiposViolencia[cat] = (tiposViolencia[cat] || 0) + 1;
    }
    for (const pw of (la.palavras_chave || [])) {
      palavras[pw] = (palavras[pw] || 0) + 1;
    }
    for (const x of (la.xingamentos || [])) {
      xingamentos[x] = (xingamentos[x] || 0) + 1;
    }
    const nivel = la.nivel_risco || "sem_risco";
    niveisRisco[nivel] = (niveisRisco[nivel] || 0) + 1;
  }

  // Also include aggressor's frequent insults
  for (const x of (agressorInfo.xingamentos_frequentes || [])) {
    if (!xingamentos[x]) xingamentos[x] = 1;
  }

  const topN = (obj: Record<string, number>, n: number) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ nome: k, contagem: v }));

  return {
    total_gravacoes_analisadas: totalAnalyzed,
    alertas_panico: (alertas || []).length,
    distribuicao_sentimentos: sentimentos,
    tipos_violencia_detectados: topN(tiposViolencia, 10),
    padroes_recorrentes: topN(padroes, 10),
    palavras_chave_frequentes: topN(palavras, 15),
    xingamentos_frequentes: topN(xingamentos, 10),
    niveis_risco_gravacoes: niveisRisco,
    informacoes_agressor: agressorInfo,
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

  const macroPrompt = await buildMacroPrompt(supabase, window_days, JSON.stringify(aggregates, null, 2));

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
