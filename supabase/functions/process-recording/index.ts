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

async function getAnalysisPrompt(supabase: any): Promise<string> {
  const FALLBACK_PROMPT = `Você atuará como um 'Especialista em Análise Contextual de Relações Conjugais', com foco na interpretação semântica e comportamental de diálogos para identificar padrões de abuso e risco, mantendo equilíbrio e bom senso.

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
  "sinais_alerta": ["sinais identificados"]
}

Se NÃO houver táticas/orientações/sinais, retorne arrays vazios.
Seja ESPECÍFICO nas evidências — cite trechos da transcrição.`;

  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("valor")
      .eq("chave", "ia_prompt_analise")
      .maybeSingle();
    return data?.valor?.trim() || FALLBACK_PROMPT;
  } catch {
    return FALLBACK_PROMPT;
  }
}

async function analyzeTranscription(transcricao: string, supabase: any): Promise<{
  resumo: string;
  sentimento: string;
  nivel_risco: string;
  categorias: string[];
  palavras_chave: string[];
  xingamentos: string[];
  analise_completa: any;
}> {
  const systemPrompt = await getAnalysisPrompt(supabase);
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
    const parsed = JSON.parse(cleanJson);
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
    // Agreggar API doesn't support webm; treat as ogg (both use Opus codec)
    if (ext === "webm") ext = "ogg";

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
