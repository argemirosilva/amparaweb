import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

function getR2Client() {
  return new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    service: "s3",
    region: "auto",
  });
}

function r2Endpoint() {
  return `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;
}

function r2Url(key: string) {
  return `${r2Endpoint()}/${Deno.env.get("R2_BUCKET_NAME")}/${key}`;
}

async function downloadFromR2(storagePath: string): Promise<Uint8Array> {
  const r2 = getR2Client();
  const url = r2Url(storagePath);
  const response = await r2.fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`R2 download failed: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Detect audio format from magic bytes */
function detectAudioFormat(bytes: Uint8Array): string {
  if (bytes.length < 12) return "mp3";
  // ID3 tag → MP3
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "mp3";
  // MP3 sync word (0xFFEx or 0xFFFx)
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return "mp3";
  // OGG
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "ogg";
  // RIFF → WAV
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "wav";
  // ftyp → MP4/M4A → send as ogg (Agreggar compat)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "ogg";
  // FLAC
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return "ogg";
  // AAC ADTS (0xFFF0-0xFFF9)
  if (bytes[0] === 0xFF && (bytes[1] & 0xF0) === 0xF0 && (bytes[1] & 0x06) === 0x00) return "ogg";
  // CAF
  if (bytes[0] === 0x63 && bytes[1] === 0x61 && bytes[2] === 0x66 && bytes[3] === 0x66) return "ogg";
  return "mp3"; // default fallback
}

// ── Speech Detection (VAD) ──

/** Pre-transcription: Analyze WAV PCM energy to detect speech presence */
function wavHasSpeech(bytes: Uint8Array): boolean | null {
  // Only works for WAV (RIFF header)
  if (bytes.length < 44) return null;
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) return null;

  // Parse WAV header
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numChannels = view.getUint16(22, true);
  const bitsPerSample = view.getUint16(34, true);

  // Only handle 16-bit PCM
  if (bitsPerSample !== 16) return null;

  // Find data chunk
  let dataOffset = 12;
  while (dataOffset < bytes.length - 8) {
    const chunkId = String.fromCharCode(bytes[dataOffset], bytes[dataOffset + 1], bytes[dataOffset + 2], bytes[dataOffset + 3]);
    const chunkSize = view.getUint32(dataOffset + 4, true);
    if (chunkId === "data") {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  if (dataOffset >= bytes.length) return null;

  // Analyze PCM samples in 50ms windows
  const bytesPerSample = 2 * numChannels;
  const sampleRate = view.getUint32(24, true);
  const windowSamples = Math.floor(sampleRate * 0.05); // 50ms windows
  const windowBytes = windowSamples * bytesPerSample;
  const totalWindows = Math.floor((bytes.length - dataOffset) / windowBytes);

  if (totalWindows < 2) return null;

  // RMS threshold for speech (~-40dBFS for 16-bit audio ≈ amplitude 328)
  const SPEECH_RMS_THRESHOLD = 300;
  const MIN_SPEECH_RATIO = 0.05; // At least 5% of windows must have speech

  let speechWindows = 0;

  for (let w = 0; w < totalWindows; w++) {
    let sumSquares = 0;
    const wStart = dataOffset + w * windowBytes;
    for (let s = 0; s < windowSamples && wStart + s * bytesPerSample + 1 < bytes.length; s++) {
      const sampleOffset = wStart + s * bytesPerSample;
      const sample = view.getInt16(sampleOffset, true);
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / windowSamples);
    if (rms > SPEECH_RMS_THRESHOLD) speechWindows++;
  }

  const speechRatio = speechWindows / totalWindows;
  console.log(`[VAD_WAV] windows=${totalWindows}, speech=${speechWindows}, ratio=${speechRatio.toFixed(3)}`);
  return speechRatio >= MIN_SPEECH_RATIO;
}

/** Post-transcription: Check if text contains meaningful speech */
const FILLER_WORDS = new Set([
  "", "hm", "hum", "hmm", "ah", "uh", "uhm", "eh", "oh", "ai",
  "é", "e", "o", "a", "os", "as", "um", "uma", "de", "do", "da",
  "no", "na", "em", "que", "se", "mas", "ou", "por", "pra", "pro",
  "com", "sem", "não", "sim", "né", "tá", "aí", "lá", "aqui",
]);

function hasMeaningfulSpeech(text: string): { meaningful: boolean; wordCount: number; meaningfulWords: number } {
  const words = text
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}""''…—–\-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 0);

  const meaningfulWords = words.filter(w => !FILLER_WORDS.has(w)).length;
  const totalWords = words.length;

  // Threshold: at least 3 meaningful words OR 5+ total words
  const meaningful = meaningfulWords >= 3 || totalWords >= 5;

  return { meaningful, wordCount: totalWords, meaningfulWords };
}
  if (bytes.length < 12) return "mp3";
  // ID3 tag → MP3
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "mp3";
  // MP3 sync word (0xFFEx or 0xFFFx)
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return "mp3";
  // OGG
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "ogg";
  // RIFF → WAV
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "wav";
  // ftyp → MP4/M4A → send as ogg (Agreggar compat)
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "ogg";
  // FLAC
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return "ogg";
  // AAC ADTS (0xFFF0-0xFFF9)
  if (bytes[0] === 0xFF && (bytes[1] & 0xF0) === 0xF0 && (bytes[1] & 0x06) === 0x00) return "ogg";
  // CAF
  if (bytes[0] === 0x63 && bytes[1] === 0x61 && bytes[2] === 0x66 && bytes[3] === 0x66) return "ogg";
  return "mp3"; // default fallback
}


async function callAI(messages: any[], model = "google/gemini-3-flash-preview"): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`AI error [${response.status}]:`, text);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function transcribeAudio(audioBytes: Uint8Array, ext: string): Promise<string> {
  const contentTypeMap: Record<string, string> = {
    mp3: "mp3", wav: "wav", webm: "webm", ogg: "ogg", alaw: "alaw", ulaw: "ulaw", m4a: "m4a",
  };
  const mimeTypeMap: Record<string, string> = {
    mp3: "audio/mpeg", wav: "audio/wav", webm: "audio/webm", ogg: "audio/ogg",
    alaw: "audio/x-alaw-basic", ulaw: "audio/basic", m4a: "audio/mp4",
  };
  const contentType = contentTypeMap[ext] || "wav";
  const mimeType = mimeTypeMap[ext] || "audio/wav";
  const fileName = `audio.${ext}`;

  const formData = new FormData();
  const blob = new Blob([audioBytes], { type: mimeType });
  formData.append("arquivo", blob, fileName);

  const url = `https://data.aggregar.com.br/transcription/Transcription/Transcribe?contenttype=${contentType}`;

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Agreggar transcription error [${response.status}]:`, errText);
    throw new Error(`Agreggar API error: ${response.status}`);
  }

  const result = await response.text();
  return result.trim();
}

// Dynamic prompt from shared utility
import { buildAnalysisPrompt, normalizeAnalysisOutput } from "../_shared/buildAnalysisPrompt.ts";

async function analyzeTranscription(transcricao: string, supabase: any): Promise<{
  resumo: string;
  sentimento: string;
  nivel_risco: string;
  categorias: string[];
  palavras_chave: string[];
  xingamentos: string[];
  analise_completa: any;
}> {
  const systemPrompt = await buildAnalysisPrompt(supabase);
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Analise esta transcrição:\n\n${transcricao}` },
  ];

  const raw = await callAI(messages);

  try {
    // Try to parse, handling potential markdown wrapping
    let cleanJson = raw.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    let parsed = JSON.parse(cleanJson);
    parsed = normalizeAnalysisOutput(parsed);
    return {
      resumo: parsed.resumo_contexto || parsed.resumo || "",
      sentimento: parsed.sentimento || "neutro",
      nivel_risco: parsed.nivel_risco || "sem_risco",
      categorias: parsed.categorias || [],
      palavras_chave: parsed.palavras_chave || [],
      xingamentos: parsed.xingamentos || [],
      analise_completa: parsed,
    };
  } catch (e) {
    console.error("Failed to parse AI analysis:", e, "Raw:", raw);
    return {
      resumo: raw.substring(0, 500),
      sentimento: "neutro",
      nivel_risco: "sem_risco",
      categorias: [],
      palavras_chave: [],
      xingamentos: [],
      analise_completa: { raw_response: raw },
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { gravacao_id } = await req.json();
    if (!gravacao_id) return json({ error: "gravacao_id obrigatório" }, 400);

    // 1. Fetch recording record
    const { data: gravacao, error: fetchErr } = await supabase
      .from("gravacoes")
      .select("id, user_id, storage_path, status, transcricao")
      .eq("id", gravacao_id)
      .single();

    if (fetchErr || !gravacao) {
      return json({ error: "Gravação não encontrada" }, 404);
    }

    if (!gravacao.storage_path) {
      return json({ error: "Gravação sem arquivo de áudio" }, 400);
    }

    // 2. Update status to processing
    await supabase
      .from("gravacoes")
      .update({ status: "processando" })
      .eq("id", gravacao_id);

    // 3. Download audio from R2
    console.log(`Downloading audio: ${gravacao.storage_path}`);
    let audioBytes: Uint8Array;
    try {
      audioBytes = await downloadFromR2(gravacao.storage_path);
    } catch (e) {
      console.error("R2 download error:", e);
      await supabase
        .from("gravacoes")
        .update({ status: "erro", erro_processamento: "Erro ao baixar áudio do storage" })
        .eq("id", gravacao_id);
      return json({ error: "Erro ao baixar áudio" }, 500);
    }

    let ext = gravacao.storage_path.split(".").pop() || "mp3";

    // Detect real format via magic bytes for ambiguous extensions
    if (ext === "audio" || ext === "caf") {
      const detected = detectAudioFormat(audioBytes);
      console.log(`[FORMAT_DETECT] ext=${ext} detected=${detected}`);
      ext = detected;
    }

    // Normalize non-standard extensions
    if (ext === "webm") ext = "ogg";
    if (ext === "m4a" || ext === "mp4") ext = "ogg";

    // 4. Transcribe via Agreggar API
    console.log(`Starting transcription via Agreggar (format=${ext})...`);
    let transcricao: string;
    try {
      transcricao = await transcribeAudio(audioBytes, ext);
    } catch (e) {
      console.error("Transcription error:", e);
      await supabase
        .from("gravacoes")
        .update({ status: "erro", erro_processamento: `Erro na transcrição: ${e.message}` })
        .eq("id", gravacao_id);
      return json({ error: "Erro na transcrição" }, 500);
    }

    // 5. Save transcription
    await supabase
      .from("gravacoes")
      .update({ transcricao, status: "transcrito" })
      .eq("id", gravacao_id);

    console.log("Transcription saved. Starting AI analysis...");

    // 6. Analyze with AI
    let analysis;
    try {
      analysis = await analyzeTranscription(transcricao, supabase);
    } catch (e) {
      console.error("Analysis error:", e);
      // Transcription succeeded, mark partially done
      await supabase
        .from("gravacoes")
        .update({ status: "erro", erro_processamento: `Erro na análise: ${e.message}` })
        .eq("id", gravacao_id);
      return json({ error: "Erro na análise de IA" }, 500);
    }

    // 7. Save analysis
    const { error: analysisErr } = await supabase
      .from("gravacoes_analises")
      .insert({
        gravacao_id: gravacao.id,
        user_id: gravacao.user_id,
        resumo: analysis.resumo,
        sentimento: analysis.sentimento,
        nivel_risco: analysis.nivel_risco,
        categorias: analysis.categorias,
        palavras_chave: analysis.palavras_chave,
        xingamentos: analysis.xingamentos,
        analise_completa: analysis.analise_completa,
        modelo_usado: "google/gemini-3-flash-preview",
      });

    if (analysisErr) {
      console.error("Save analysis error:", analysisErr);
      await supabase
        .from("gravacoes")
        .update({ status: "erro", erro_processamento: "Erro ao salvar análise" })
        .eq("id", gravacao_id);
      return json({ error: "Erro ao salvar análise" }, 500);
    }

    // 8. Mark as fully processed
    await supabase
      .from("gravacoes")
      .update({ status: "processado", processado_em: new Date().toISOString() })
      .eq("id", gravacao_id);

    await supabase.from("audit_logs").insert({
      user_id: gravacao.user_id,
      action_type: "gravacao_processed",
      success: true,
      details: {
        gravacao_id,
        nivel_risco: analysis.nivel_risco,
        categorias: analysis.categorias,
      },
    });

    // 9. Fire-and-forget: notify guardians if risk is alto or critico
    if (analysis.nivel_risco === "alto" || analysis.nivel_risco === "critico") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "notify_alert",
          user_id: gravacao.user_id,
          tipo: analysis.nivel_risco,
        }),
      }).catch((e) => console.error("WhatsApp notify error from process-recording:", e));
    }

    // 10. Fire-and-forget: enqueue MICRO analysis in new pipeline
    {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${supabaseUrl}/functions/v1/analysis-worker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "enqueueMicro",
          recording_id: gravacao_id,
          user_id: gravacao.user_id,
        }),
      }).catch((e) => console.error("Analysis worker enqueue error:", e));
    }

    console.log(`Recording ${gravacao_id} fully processed.`);
    return json({
      success: true,
      gravacao_id,
      transcricao,
      analise: {
        resumo: analysis.resumo,
        sentimento: analysis.sentimento,
        nivel_risco: analysis.nivel_risco,
        categorias: analysis.categorias,
        palavras_chave: analysis.palavras_chave,
      },
    });
  } catch (err) {
    console.error("process-recording error:", err);
    return json({ error: "Erro interno no processamento" }, 500);
  }
});
