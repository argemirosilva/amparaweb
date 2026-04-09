import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.4";

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

// ── R2 helpers ──

function getR2Client() {
  return new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    service: "s3",
    region: "auto",
  });
}

function r2Url(key: string) {
  return `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${Deno.env.get("R2_BUCKET_NAME")}/${key}`;
}

// ── Palavras triagem cache (5 min TTL) ──

let cachedWords: { palavras: { palavra: string; grupo: string; peso: number }[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function getTriageWords(supabase: ReturnType<typeof createClient>) {
  if (cachedWords && Date.now() - cachedWords.fetchedAt < CACHE_TTL_MS) {
    return cachedWords.palavras;
  }
  const { data } = await supabase
    .from("palavras_triagem")
    .select("palavra, grupo, peso")
    .eq("ativo", true);
  const palavras = (data || []).map((p: any) => ({
    palavra: normalize(p.palavra),
    grupo: p.grupo,
    peso: p.peso,
  }));
  cachedWords = { palavras, fetchedAt: Date.now() };
  return palavras;
}

// ── Transcription provider config cache ──

let cachedTranscriptionConfig: { provider: string; apiUrl: string; fetchedAt: number } | null = null;

async function getTranscriptionConfig(supabase: ReturnType<typeof createClient>) {
  if (cachedTranscriptionConfig && Date.now() - cachedTranscriptionConfig.fetchedAt < CACHE_TTL_MS) {
    return cachedTranscriptionConfig;
  }
  const { data } = await supabase
    .from("admin_settings")
    .select("chave, valor")
    .in("chave", ["transcricao_provider", "transcricao_api_url"]);
  
  const map: Record<string, string> = {};
  for (const row of data || []) map[row.chave] = row.valor;

  const config = {
    provider: map["transcricao_provider"] || "lovable_ai",
    apiUrl: map["transcricao_api_url"] || "https://api.agreggar.com/Transcription/Transcribe",
    fetchedAt: Date.now(),
  };
  cachedTranscriptionConfig = config;
  return config;
}

// ── Text normalization (lowercase + remove accents) ──

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ── Transcription via configurable provider ──

async function transcribeSegment(storagePath: string, supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000];

  // Download from R2 (once)
  let audioBytes: Uint8Array;
  try {
    const r2 = getR2Client();
    const r2Resp = await r2.fetch(r2Url(storagePath), { method: "GET" });
    if (!r2Resp.ok) {
      console.error(`R2 download failed: ${r2Resp.status}`);
      return null;
    }
    audioBytes = new Uint8Array(await r2Resp.arrayBuffer());
  } catch (e) {
    console.error("R2 download error:", e);
    return null;
  }

  const config = await getTranscriptionConfig(supabase);
  console.log(`[TRIAGE] Transcription provider: ${config.provider}`);

  if (config.provider === "lovable_ai") {
    return transcribeViaLovableAI(audioBytes, storagePath, MAX_RETRIES, RETRY_DELAYS);
  } else {
    return transcribeViaAgreggar(audioBytes, storagePath, config.apiUrl, MAX_RETRIES, RETRY_DELAYS);
  }
}

// ── Lovable AI Gateway transcription (Gemini Flash with audio) ──

async function transcribeViaLovableAI(
  audioBytes: Uint8Array,
  storagePath: string,
  maxRetries: number,
  retryDelays: number[]
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured for transcription");
    return null;
  }

  // Detect mime type from extension
  const ext = storagePath.split(".").pop()?.toLowerCase() || "ogg";
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/ogg",
    wav: "audio/wav", webm: "audio/webm", m4a: "audio/mp4",
    mp4: "audio/mp4", aac: "audio/aac", caf: "audio/x-caf",
  };
  const mimeType = mimeMap[ext] || "audio/ogg";

  // Convert to base64 (chunk to avoid stack overflow)
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < audioBytes.length; i += CHUNK) {
    binary += String.fromCharCode(...audioBytes.subarray(i, i + CHUNK));
  }
  const base64Audio = btoa(binary);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Você é um transcritor de áudio. Transcreva exatamente o que é dito no áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação, sem aspas, sem explicações. Se não houver fala, retorne uma string vazia.",
            },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: { data: base64Audio, format: ext === "wav" ? "wav" : "mp3" },
                },
                { type: "text", text: "Transcreva o áudio acima." },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error(`Lovable AI transcription error (attempt ${attempt + 1}/${maxRetries}): ${res.status} — ${body}`);
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, retryDelays[attempt]));
          continue;
        }
        return null;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || null;
      console.log(`[TRIAGE] Lovable AI transcription OK (${text?.length || 0} chars)`);
      return text;
    } catch (e) {
      console.error(`Lovable AI transcription error (attempt ${attempt + 1}/${maxRetries}):`, e);
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ── Agreggar API transcription (legacy) ──

async function transcribeViaAgreggar(
  audioBytes: Uint8Array,
  storagePath: string,
  apiUrl: string,
  maxRetries: number,
  retryDelays: number[]
): Promise<string | null> {
  const ext = storagePath.split(".").pop()?.toLowerCase() || "ogg";
  const formatMap: Record<string, string> = {
    mp3: "ogg", mp4: "ogg", m4a: "ogg", aac: "ogg", caf: "ogg",
    ogg: "ogg", opus: "ogg", wav: "wav", webm: "ogg",
  };
  const format = formatMap[ext] || "ogg";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append("file", new Blob([audioBytes]), `audio.${format}`);
      formData.append("format", format);
      formData.append("language", "pt");

      const agreggarRes = await fetch(apiUrl, { method: "POST", body: formData });

      if (!agreggarRes.ok) {
        const body = await agreggarRes.text();
        console.error(`Agreggar error (attempt ${attempt + 1}/${maxRetries}): ${agreggarRes.status} — ${body}`);
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, retryDelays[attempt]));
          continue;
        }
        return null;
      }

      const result = await agreggarRes.json();
      return result?.text || result?.transcription || null;
    } catch (e) {
      console.error(`Agreggar error (attempt ${attempt + 1}/${maxRetries}):`, e);
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ── Keyword scan ──

interface KeywordMatch {
  palavra: string;
  grupo: string;
  peso: number;
}

function scanKeywords(
  normalizedText: string,
  palavras: { palavra: string; grupo: string; peso: number }[]
): KeywordMatch[] {
  const matches: KeywordMatch[] = [];
  for (const p of palavras) {
    // Word boundary match
    const regex = new RegExp(`\\b${p.palavra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (regex.test(normalizedText)) {
      matches.push(p);
    }
  }
  return matches;
}

// ── AI risk classification ──

import { buildTriagePrompt } from "../_shared/buildAnalysisPrompt.ts";

// Cache triage prompt (5 min TTL)
let cachedTriagePrompt: { prompt: string; fetchedAt: number } | null = null;

async function getTriagePrompt(supabase: ReturnType<typeof createClient>): Promise<string> {
  if (cachedTriagePrompt && Date.now() - cachedTriagePrompt.fetchedAt < CACHE_TTL_MS) {
    return cachedTriagePrompt.prompt;
  }
  const prompt = await buildTriagePrompt(supabase);
  cachedTriagePrompt = { prompt, fetchedAt: Date.now() };
  return prompt;
}

interface TriageResult {
  nivel_risco: string;
  motivo?: string;
  contexto_emergencia?: {
    ameaca_morte?: boolean;
    agressao_fisica?: boolean;
    agressao_em_curso?: boolean;
    ameaca_agressao_fisica?: boolean;
    pedido_socorro?: boolean;
    mencao_arma?: boolean;
    descricao_curta?: string;
  };
}

async function classifyRisk(
  transcricao: string,
  matches: KeywordMatch[],
  supabase: ReturnType<typeof createClient>
): Promise<TriageResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return { nivel_risco: "moderado" };
  }

  const matchList = matches.map((m) => `${m.palavra} (${m.grupo})`).join(", ");
  const systemPrompt = await getTriagePrompt(supabase);

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Palavras detectadas: [${matchList}]\nTranscrição: ${transcricao}` },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`AI classification error: ${res.status}`);
      return { nivel_risco: "moderado" };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    let clean = raw.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const valid = ["sem_risco", "moderado", "alto", "critico"];
      const nivel = parsed.nivel_risco || parsed.resultado;
      if (valid.includes(nivel)) {
        return {
          nivel_risco: nivel,
          motivo: parsed.motivo,
          contexto_emergencia: parsed.contexto_emergencia || undefined,
        };
      }
    }
    return { nivel_risco: "moderado" };
  } catch (e) {
    console.error("AI classification error:", e);
    return { nivel_risco: "moderado" };
  }
}

// ── Fire-and-forget helpers ──

function fireWhatsApp(userId: string, tipo: string, lat?: number | null, lon?: number | null, alertaId?: string | null, contexto?: TriageResult["contexto_emergencia"]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const body: Record<string, unknown> = { action: "notify_alert", user_id: userId, tipo };
  if (lat != null) body.lat = lat;
  if (lon != null) body.lon = lon;
  if (alertaId) body.alerta_id = alertaId;
  if (contexto) body.contexto = contexto;

  fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((e) => console.error("fireWhatsApp error:", e));
}

function fireCopomCall(userId: string, alertaId: string, contexto?: TriageResult["contexto_emergencia"]) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const body: Record<string, unknown> = { user_id: userId, skip_cooldown: false };
  if (contexto) body.contexto = contexto;

  fetch(`${supabaseUrl}/functions/v1/copom-outbound-call`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((e) => console.error("fireCopomCall error:", e));
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { segment_id, user_id, storage_path } = await req.json();
    if (!segment_id || !user_id || !storage_path) {
      return json({ error: "segment_id, user_id, storage_path obrigatórios" }, 400);
    }

    console.log(`[TRIAGE] Starting for segment ${segment_id}, user ${user_id}`);

    // 1. Transcribe
    const transcricao = await transcribeSegment(storage_path, supabase);
    if (!transcricao || transcricao.trim().length < 3) {
      // No usable transcription — leave triage_risco NULL so segment is treated as relevant (safe fallback)
      console.log(`[TRIAGE] No transcription for segment ${segment_id} — keeping as relevant (NULL)`);
      return json({ ok: true, risco: null, reason: "no_transcription" });
    }

    const normalizedText = normalize(transcricao);

    // 2. Keyword scan
    const palavras = await getTriageWords(supabase);
    const matches = scanKeywords(normalizedText, palavras);

    if (matches.length === 0) {
      // No keyword matches — sem_risco
      await supabase
        .from("gravacoes_segmentos")
        .update({ triage_risco: "sem_risco", triage_transcricao: transcricao, triage_at: new Date().toISOString() })
        .eq("id", segment_id);
      console.log(`[TRIAGE] No keyword matches for segment ${segment_id}`);
      return json({ ok: true, risco: "sem_risco", reason: "no_keyword_match" });
    }

    console.log(`[TRIAGE] ${matches.length} keyword matches: ${matches.map(m => m.palavra).join(", ")}`);

    // 3. AI classification
    const triageResult = await classifyRisk(transcricao, matches, supabase);
    const nivelRisco = triageResult.nivel_risco;

    // 4. Save triage result
    const now = new Date().toISOString();
    await supabase
      .from("gravacoes_segmentos")
      .update({
        triage_risco: nivelRisco,
        triage_transcricao: transcricao,
        triage_at: now,
        triage_contexto: triageResult.contexto_emergencia || null,
      })
      .eq("id", segment_id);

    // 5. Audit log
    await supabase.from("audit_logs").insert({
      user_id,
      action_type: "segment_triage",
      success: true,
      details: {
        segment_id,
        nivel_risco: nivelRisco,
        motivo: triageResult.motivo || null,
        contexto_emergencia: triageResult.contexto_emergencia || null,
        keywords_matched: matches.map((m) => m.palavra),
        keywords_count: matches.length,
      },
    });

    // 6. Alert triggering for alto/critico
    if (nivelRisco === "alto" || nivelRisco === "critico") {
      // Fetch recent location
      const { data: loc } = await supabase
        .from("localizacoes")
        .select("latitude, longitude")
        .eq("user_id", user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Create alert record for GPS sharing
      const protocolo = `TRIAGE-${Date.now().toString(36).toUpperCase()}`;
      const { data: alerta } = await supabase
        .from("alertas_panico")
        .insert({
          user_id,
          status: "ativo",
          tipo_acionamento: "triagem_automatica",
          protocolo,
          latitude: loc?.latitude || null,
          longitude: loc?.longitude || null,
        })
        .select("id")
        .single();

      const alertaId = alerta?.id || null;

      // WhatsApp notification with context
      fireWhatsApp(user_id, nivelRisco, loc?.latitude, loc?.longitude, alertaId, triageResult.contexto_emergencia);

      // COPOM call for critico with context
      if (nivelRisco === "critico" && alertaId) {
        fireCopomCall(user_id, alertaId, triageResult.contexto_emergencia);
      }

      console.log(`[TRIAGE] Alert triggered: ${nivelRisco} for user ${user_id}, alerta_id=${alertaId}`);
    }

    return json({ ok: true, risco: nivelRisco, keywords: matches.length });
  } catch (err) {
    console.error("[TRIAGE] Error:", err);
    return json({ error: "Erro interno na triagem" }, 500);
  }
});
