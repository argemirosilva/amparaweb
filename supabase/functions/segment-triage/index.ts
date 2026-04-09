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

// ── Text normalization (lowercase + remove accents) ──

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ── Transcription via Agreggar ──

async function transcribeSegment(storagePath: string): Promise<string | null> {
  try {
    // Download from R2
    const r2 = getR2Client();
    const r2Resp = await r2.fetch(r2Url(storagePath), { method: "GET" });
    if (!r2Resp.ok) {
      console.error(`R2 download failed: ${r2Resp.status}`);
      return null;
    }
    const audioBytes = new Uint8Array(await r2Resp.arrayBuffer());

    // Detect format from extension
    const ext = storagePath.split(".").pop()?.toLowerCase() || "ogg";
    // Map iOS formats to ogg for Agreggar compatibility
    const formatMap: Record<string, string> = {
      mp3: "ogg", mp4: "ogg", m4a: "ogg", aac: "ogg", caf: "ogg",
      ogg: "ogg", opus: "ogg", wav: "wav", webm: "ogg",
    };
    const format = formatMap[ext] || "ogg";

    // Call Agreggar
    const formData = new FormData();
    formData.append("file", new Blob([audioBytes]), `audio.${format}`);
    formData.append("format", format);
    formData.append("language", "pt");

    const agreggarRes = await fetch(
      "https://api.agreggar.com/Transcription/Transcribe",
      { method: "POST", body: formData }
    );

    if (!agreggarRes.ok) {
      console.error(`Agreggar error: ${agreggarRes.status}`);
      return null;
    }

    const result = await agreggarRes.json();
    return result?.text || result?.transcription || null;
  } catch (e) {
    console.error("Transcription error:", e);
    return null;
  }
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

async function classifyRisk(
  transcricao: string,
  matches: KeywordMatch[],
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return "moderado"; // fallback
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
      return "moderado";
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
      if (valid.includes(nivel)) return nivel;
    }
    return "moderado";
  } catch (e) {
    console.error("AI classification error:", e);
    return "moderado";
  }
}

// ── Fire-and-forget helpers ──

function fireWhatsApp(userId: string, tipo: string, lat?: number | null, lon?: number | null, alertaId?: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const body: Record<string, unknown> = { action: "notify_alert", user_id: userId, tipo };
  if (lat != null) body.lat = lat;
  if (lon != null) body.lon = lon;
  if (alertaId) body.alerta_id = alertaId;

  fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((e) => console.error("fireWhatsApp error:", e));
}

function fireCopomCall(userId: string, alertaId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  fetch(`${supabaseUrl}/functions/v1/copom-outbound-call`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, skip_cooldown: false }),
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
    const transcricao = await transcribeSegment(storage_path);
    if (!transcricao || transcricao.trim().length < 3) {
      // No usable transcription — mark as sem_risco
      await supabase
        .from("gravacoes_segmentos")
        .update({ triage_risco: "sem_risco", triage_transcricao: transcricao || "", triage_at: new Date().toISOString() })
        .eq("id", segment_id);
      console.log(`[TRIAGE] No transcription for segment ${segment_id}`);
      return json({ ok: true, risco: "sem_risco", reason: "no_transcription" });
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
    const nivelRisco = await classifyRisk(transcricao, matches);

    // 4. Save triage result
    const now = new Date().toISOString();
    await supabase
      .from("gravacoes_segmentos")
      .update({ triage_risco: nivelRisco, triage_transcricao: transcricao, triage_at: now })
      .eq("id", segment_id);

    // 5. Audit log
    await supabase.from("audit_logs").insert({
      user_id,
      action_type: "segment_triage",
      success: true,
      details: {
        segment_id,
        nivel_risco: nivelRisco,
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

      // WhatsApp notification
      fireWhatsApp(user_id, nivelRisco, loc?.latitude, loc?.longitude, alertaId);

      // COPOM call for critico
      if (nivelRisco === "critico" && alertaId) {
        fireCopomCall(user_id, alertaId);
      }

      console.log(`[TRIAGE] Alert triggered: ${nivelRisco} for user ${user_id}, alerta_id=${alertaId}`);
    }

    return json({ ok: true, risco: nivelRisco, keywords: matches.length });
  } catch (err) {
    console.error("[TRIAGE] Error:", err);
    return json({ error: "Erro interno na triagem" }, 500);
  }
});
