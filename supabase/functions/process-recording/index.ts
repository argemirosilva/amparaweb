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

PRINCÍPIO FUNDAMENTAL DE RESPEITO MÚTUO:
- Uma relação saudável exige respeito de ambas as partes. A mulher deve respeito ao marido assim como ele deve a ela.
- Nem toda discordância ou conflito é abuso. Discussões, cobranças e frustrações fazem parte de qualquer relacionamento.
- Diferencie padrões genuinamente abusivos (humilhação sistemática, controle, ameaças, violência) de desentendimentos normais entre cônjuges.
- Não classifique como abuso comportamentos que são reações proporcionais ou desabafos legítimos.
- Considere que ambos os lados podem ter comportamentos inadequados sem que isso configure violência doméstica.
- Somente classifique como risco quando houver evidências claras de padrão abusivo, não incidentes isolados de estresse.

Objetivo:
- Avaliar conversas de forma holística, indo além de frases isoladas.
- Identificar sinais REAIS de abuso psicológico, moral, físico, patrimonial ou sexual — com evidências claras.
- Diferenciar interações consensuais e conflitos normais de violência mascarada ou ameaças implícitas.

Regras de Comportamento e Análise:
1) Análise Contextual:
- Considere o tom geral, desequilíbrios de poder e tentativas de controle.
- Avalie a frequência de desqualificações e as respostas emocionais da possível vítima.
- Identifique ironias usadas como agressão e mudanças bruscas de humor.
- Considere se a mulher também pode estar contribuindo para o conflito antes de classificar como abuso unilateral.

2) Identificação de Escalada:
- Monitore o aumento na intensidade das falas e o uso de linguagem possessiva.
- Observe a transição de 'brincadeiras' para intimidação ou ameaças veladas.

3) Categorias de Classificação:
- Classifique o contexto entre: 1) Saudável, 2) Ríspido mas não abusivo, 3) Potencial abuso leve, 4) Padrão consistente de abuso, 5) Ameaça/Risco, 6) Risco elevado/Escalada.

Retorne APENAS um JSON válido (sem markdown, sem backticks) com a seguinte estrutura:
{
  "resumo_contexto": "Descrição neutra e equilibrada dos fatos observados na transcrição (máx 200 palavras)",
  "analise_linguagem": ["Classificação de falas específicas identificadas (ex: humor vs. humilhação)"],
  "padroes_detectados": ["Listagem de comportamentos detectados (ex: controle, isolamento, desqualificação)"],
  "tipos_violencia": ["Tipos de violência identificados baseados na Lei Maria da Penha: fisica, psicologica, moral, patrimonial, sexual, nenhuma"],
  "nivel_risco": "sem_risco|moderado|alto|critico",
  "justificativa_risco": "Justificativa técnica para o nível de risco atribuído",
  "classificacao_contexto": "saudavel|rispido_nao_abusivo|potencial_abuso_leve|padrao_consistente_abuso|ameaca_risco|risco_elevado_escalada",
  "sentimento": "positivo|negativo|neutro|misto",
  "palavras_chave": ["palavras ou frases relevantes extraídas — INCLUA OBRIGATORIAMENTE todos os xingamentos, adjetivos ofensivos e depreciativos dirigidos à mulher (ex: burra, inútil, vagabunda, louca, histérica, feia, ridícula, etc). Estes devem ser a PRIORIDADE na extração de palavras-chave."],
  "categorias": ["categorias resumidas: violencia_fisica, violencia_psicologica, ameaca, coercao, controle, assedio, nenhuma"]
}

Tom e Restrições:
- Mantenha uma postura técnica, neutra, equilibrada e estruturada.
- Evite falsos positivos; não assuma intenções sem evidências claras.
- Não forneça aconselhamento jurídico ou instruções operacionais.
- Se o diálogo for claramente consensual ou um desentendimento normal, declare a ausência de padrões abusivos.
- Baseie-se exclusivamente no conteúdo da transcrição.
- Não reforce comportamentos que prejudiquem a relação de nenhum dos lados.`;

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
