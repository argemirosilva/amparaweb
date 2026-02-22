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

function getDefaultAnalysisPrompt(): string {
  return `Você atuará como um 'Especialista em Análise Contextual de Violência Doméstica'.
Analise a transcrição e retorne APENAS JSON válido com:
{"resumo_contexto":"...","analise_linguagem":[],"padroes_detectados":[],"tipos_violencia":[],"nivel_risco":"sem_risco|moderado|alto|critico","justificativa_risco":"...","classificacao_contexto":"...","sentimento":"positivo|negativo|neutro|misto","palavras_chave":[],"categorias":[]}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json().catch(() => ({}));
  const batchSize = body.batch_size || 5;
  const autoChain = body.auto_chain !== false; // default true

  // Find recordings with transcription that do NOT have an analysis yet
  const { data: pending } = await supabase
    .rpc("get_unanalyzed_gravacoes", { p_limit: batchSize });

  // Count total remaining efficiently
  const { data: countData } = await supabase.rpc("count_unanalyzed_gravacoes");
  const remainingCount = countData || 0;

  if (!pending || pending.length === 0) {
    return json({ ok: true, message: "Todas já foram analisadas", analyzed: 0, remaining: 0 });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  let systemPrompt = getDefaultAnalysisPrompt();

  try {
    const { data: promptData } = await supabase
      .from("admin_settings")
      .select("valor")
      .eq("chave", "ia_prompt_analise")
      .maybeSingle();
    if (promptData?.valor?.trim()) systemPrompt = promptData.valor.trim();
  } catch { /* use default */ }

  const toProcess = pending; // already limited by RPC
  let analyzedCount = 0;
  const errors: string[] = [];

  for (const grav of toProcess) {
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analise esta transcrição:\n\n${grav.transcricao}` },
          ],
        }),
      });

      if (!aiRes.ok) {
        errors.push(`${grav.id}: AI ${aiRes.status}`);
        continue;
      }

      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "";

      let cleanJson = raw.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      let parsed: any;
      try {
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanJson);
      } catch {
        parsed = {
          resumo_contexto: raw.substring(0, 500),
          nivel_risco: "moderado",
          sentimento: "neutro",
          categorias: [],
          palavras_chave: [],
        };
      }

      const { error: insErr } = await supabase.from("gravacoes_analises").insert({
        gravacao_id: grav.id,
        user_id: grav.user_id,
        resumo: parsed.resumo_contexto || parsed.resumo || "",
        sentimento: parsed.sentimento || "neutro",
        nivel_risco: parsed.nivel_risco || "sem_risco",
        categorias: parsed.categorias || [],
        palavras_chave: parsed.palavras_chave || [],
        analise_completa: parsed,
        modelo_usado: "google/gemini-2.5-flash",
      });

      if (insErr) {
        errors.push(`${grav.id}: insert error ${insErr.message}`);
      } else {
        analyzedCount++;
      }
    } catch (e) {
      errors.push(`${grav.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Chain if we processed a full batch (likely more pending)
  const mayHaveMore = toProcess.length === batchSize && analyzedCount > 0;

  if (autoChain && mayHaveMore) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${supabaseUrl}/functions/v1/run-batch-analysis`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batch_size: batchSize, auto_chain: true }),
    }).catch((e) => console.error("Chain call error:", e));
    console.log(`Chained next batch. Analyzed: ${analyzedCount}/${toProcess.length}`);
  }

  // Remaining = total remaining minus what we just analyzed
  const finalRemaining = Math.max(0, (remainingCount || 0) - analyzedCount);

  return json({
    ok: true,
    analyzed: analyzedCount,
    batch_size: toProcess.length,
    remaining: finalRemaining,
    auto_chain: autoChain && mayHaveMore,
    errors: errors.length > 0 ? errors : undefined,
  });
});
