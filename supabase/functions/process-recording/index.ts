import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.540.0";

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
  return new S3Client({
    region: "auto",
    endpoint: `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
      secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    },
  });
}

async function downloadFromR2(storagePath: string): Promise<Uint8Array> {
  const r2 = getR2Client();
  const command = new GetObjectCommand({
    Bucket: Deno.env.get("R2_BUCKET_NAME")!,
    Key: storagePath,
  });
  const response = await r2.send(command);
  const stream = response.Body as ReadableStream;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
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

async function analyzeTranscription(transcricao: string): Promise<{
  resumo: string;
  sentimento: string;
  nivel_risco: string;
  categorias: string[];
  palavras_chave: string[];
  analise_completa: any;
}> {
  const messages = [
    {
      role: "system",
      content: `Você é um analista especializado em situações de violência doméstica. Analise a transcrição fornecida e retorne APENAS um JSON válido (sem markdown, sem backticks) com a seguinte estrutura:
{
  "resumo": "resumo breve do conteúdo (máx 200 palavras)",
  "sentimento": "positivo|negativo|neutro|misto",
  "nivel_risco": "baixo|medio|alto|critico",
  "categorias": ["lista de categorias identificadas como: violencia_fisica, violencia_psicologica, ameaca, coercao, controle, assedio, nenhuma"],
  "palavras_chave": ["palavras ou frases relevantes extraídas"],
  "indicadores_risco": ["indicadores específicos de risco identificados"],
  "recomendacoes": ["recomendações baseadas na análise"]
}
Seja objetivo e baseie-se exclusivamente no conteúdo da transcrição.`,
    },
    {
      role: "user",
      content: `Analise esta transcrição:\n\n${transcricao}`,
    },
  ];

  const raw = await callAI(messages);

  try {
    // Try to parse, handling potential markdown wrapping
    let cleanJson = raw.trim();
    if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleanJson);
    return {
      resumo: parsed.resumo || "",
      sentimento: parsed.sentimento || "neutro",
      nivel_risco: parsed.nivel_risco || "baixo",
      categorias: parsed.categorias || [],
      palavras_chave: parsed.palavras_chave || [],
      analise_completa: parsed,
    };
  } catch (e) {
    console.error("Failed to parse AI analysis:", e, "Raw:", raw);
    return {
      resumo: raw.substring(0, 500),
      sentimento: "neutro",
      nivel_risco: "baixo",
      categorias: [],
      palavras_chave: [],
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

    const ext = gravacao.storage_path.split(".").pop() || "mp3";

    // 4. Transcribe via Agreggar API
    console.log("Starting transcription via Agreggar...");
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
      analysis = await analyzeTranscription(transcricao);
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
