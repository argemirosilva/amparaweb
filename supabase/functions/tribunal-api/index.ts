import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tribunal-key",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashSessionToken(token: string): Promise<string> {
  return sha256(token);
}

// ── Auth helpers ──

interface AuthResult {
  tenantId: string | null;
  apiKeyId: string | null;
  userId: string | null;
  via: "api_key" | "session";
  isMagistrado?: boolean;
  scope?: "nacional" | "tenant";
}

async function authenticateRequest(
  supabase: any,
  req: Request,
  body: any,
): Promise<AuthResult | Response> {
  // 1. Try X-Tribunal-Key header
  const apiKey = req.headers.get("x-tribunal-key");
  if (apiKey) {
    const keyHash = await sha256(apiKey);
    const { data: keyRow } = await supabase
      .from("tribunal_api_keys")
      .select("id, tenant_id, ativo, expires_at")
      .eq("key_hash", keyHash)
      .eq("ativo", true)
      .maybeSingle();
    if (!keyRow) return json({ error: "API key inválida ou inativa" }, 401);
    if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date())
      return json({ error: "API key expirada" }, 401);
    return { tenantId: keyRow.tenant_id, apiKeyId: keyRow.id, userId: null, via: "api_key", scope: "tenant" };
  }

  // 2. Try session_token in body
  const sessionToken = body?.session_token;
  if (sessionToken) {
    const tokenHash = await hashSessionToken(sessionToken);
    const { data: session } = await supabase
      .from("user_sessions")
      .select("user_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (!session || new Date(session.expires_at) < new Date())
      return json({ error: "Sessão inválida ou expirada" }, 401);

    // Check role: admin OR magistrado
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user_id);
    const roleNames = (roles || []).map((r: any) => r.role);
    const isAdmin = roleNames.some((r: string) =>
      ["super_administrador", "administrador"].includes(r),
    );
    const isMagistrado = roleNames.includes("magistrado");
    if (!isAdmin && !isMagistrado) return json({ error: "Acesso negado" }, 403);

    // Magistrado e Admin têm escopo nacional
    return {
      tenantId: null,
      apiKeyId: null,
      userId: session.user_id,
      via: "session",
      isMagistrado,
      scope: "nacional",
    };
  }

  return json({ error: "Autenticação necessária (X-Tribunal-Key ou session_token)" }, 401);
}

// ── Prompt builder ──

async function buildPrompt(
  supabase: any,
  modo: string,
): Promise<{ prompt: string; version: string }> {
  const { data: basePrompt } = await supabase
    .from("tribunal_prompts")
    .select("conteudo, versao")
    .eq("tipo", "base")
    .eq("ativo", true)
    .maybeSingle();

  const { data: modoPrompt } = await supabase
    .from("tribunal_prompts")
    .select("conteudo, versao")
    .eq("tipo", modo)
    .eq("ativo", true)
    .maybeSingle();

  const base = basePrompt?.conteudo || "";
  const modoContent = modoPrompt?.conteudo || "";
  const version = `base_v${basePrompt?.versao || 0}_${modo}_v${modoPrompt?.versao || 0}`;

  return { prompt: `${base}\n\n${modoContent}`, version };
}

// ── Data gathering ──

async function findUsuario(supabase: any, dados: any): Promise<any | null> {
  if (!dados) return null;
  // Try CPF last4 + name
  let query = supabase.from("usuarios").select("id, nome_completo, email, telefone, endereco_cidade, endereco_uf, cor_raca, escolaridade, profissao, mora_com_agressor, tem_filhos, data_nascimento");
  if (dados.cpf_last4) {
    // No CPF on usuarios, search by name
  }
  if (dados.nome) {
    query = query.ilike("nome_completo", `%${dados.nome.split(" ")[0]}%`);
  }
  if (dados.telefone) {
    query = query.eq("telefone", dados.telefone);
  }
  const { data } = await query.limit(5);
  return data?.[0] || null;
}

async function findAgressor(supabase: any, dados: any): Promise<any | null> {
  if (!dados) return null;
  let query = supabase.from("agressores").select("id, nome, display_name_masked, risk_score, risk_level, violence_profile_probs, forca_seguranca, tem_arma_em_casa, primary_city_uf, profession, aliases, xingamentos_frequentes, cor_raca, escolaridade, data_nascimento, neighborhoods, phone_clues, vehicles, flags, last_incident_at");
  if (dados.cpf_last4) {
    query = query.eq("cpf_last4", dados.cpf_last4);
  } else if (dados.nome) {
    query = query.ilike("nome", `%${dados.nome.split(" ")[0]}%`);
  }
  const { data } = await query.limit(5);
  return data?.[0] || null;
}

async function gatherAmparaData(supabase: any, usuarioId: string | null, agressorId: string | null) {
  const result: any = { micro_analyses: [], macro_reports: [], risk_assessments: [], recordings_summary: [], external_data: [] };

  if (usuarioId) {
    const { data: micro } = await supabase
      .from("analysis_micro_results")
      .select("risk_level, context_classification, cycle_phase, output_json, created_at")
      .eq("user_id", usuarioId)
      .eq("latest", true)
      .order("created_at", { ascending: false })
      .limit(20);
    result.micro_analyses = micro || [];

    const { data: macro } = await supabase
      .from("analysis_macro_reports")
      .select("output_json, window_days, created_at, status")
      .eq("user_id", usuarioId)
      .eq("latest", true)
      .order("created_at", { ascending: false })
      .limit(3);
    result.macro_reports = macro || [];

    const { data: risk } = await supabase
      .from("risk_assessments")
      .select("risk_score, risk_level, trend, trend_percentage, fatores, resumo_tecnico, computed_at")
      .eq("usuario_id", usuarioId)
      .order("computed_at", { ascending: false })
      .limit(3);
    result.risk_assessments = risk || [];

    const { data: recs } = await supabase
      .from("gravacoes")
      .select("id, duracao_segundos, status, created_at")
      .eq("user_id", usuarioId)
      .eq("status", "processado")
      .order("created_at", { ascending: false })
      .limit(10);
    result.recordings_summary = (recs || []).map((r: any) => ({
      id: r.id,
      duracao: r.duracao_segundos,
      data: r.created_at,
    }));
  }

  // External data from previous tribunal queries
  if (usuarioId || agressorId) {
    let extQuery = supabase
      .from("tribunal_dados_externos")
      .select("tipo_dado, numero_referencia, resumo, dados_json, data_referencia, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (usuarioId) extQuery = extQuery.eq("usuario_id", usuarioId);
    else if (agressorId) extQuery = extQuery.eq("agressor_id", agressorId);
    const { data: ext } = await extQuery;
    result.external_data = ext || [];
  }

  return result;
}

// ── Analysis object builder ──

function buildAnalysisObject(amparaData: any, dadosProcesso: any, agressor: any, usuario: any, dadosMagistradoInput: any) {
  const riskAssessment = amparaData.risk_assessments[0];
  const microResults = amparaData.micro_analyses;

  // Aggregate risk indicators
  const riskLevels = microResults.map((m: any) => m.risk_level);
  const hasHigh = riskLevels.includes("alto") || riskLevels.includes("critico");
  const contextTypes = microResults.map((m: any) => m.context_classification);

  const indicadores: any[] = [];
  if (agressor?.forca_seguranca) indicadores.push({ nome: "Vínculo com forças de segurança", presente: true, peso: 5, fonte: "ampara" });
  if (agressor?.tem_arma_em_casa) indicadores.push({ nome: "Arma de fogo no domicílio", presente: true, peso: 5, fonte: "ampara" });
  if (usuario?.mora_com_agressor) indicadores.push({ nome: "Coabitação com agressor", presente: true, peso: 4, fonte: "ampara" });
  if (usuario?.tem_filhos) indicadores.push({ nome: "Presença de filhos menores", presente: true, peso: 3, fonte: "ampara" });
  if (hasHigh) indicadores.push({ nome: "Histórico de análises de alto risco", presente: true, peso: 4, fonte: "ampara" });

  // Process tribunal data
  const fatores: any[] = [];
  if (dadosProcesso) {
    fatores.push({
      fator: `Documento judicial: ${dadosProcesso.tipo || "processo"}`,
      gravidade: "media",
      fonte: "tribunal",
      detalhes: dadosProcesso.resumo || dadosProcesso.conteudo?.substring(0, 200),
    });
  }

  // From previous external data
  for (const ext of amparaData.external_data.slice(0, 5)) {
    fatores.push({
      fator: `Dado externo anterior: ${ext.tipo_dado}`,
      gravidade: "media",
      fonte: "tribunal",
      detalhes: ext.resumo,
    });
  }

  // Patterns from micro
  const padroes: any[] = [];
  const cyclePhases = [...new Set(microResults.map((m: any) => m.cycle_phase).filter(Boolean))];
  if (cyclePhases.length > 0) {
    padroes.push({ padrao: "Fases do ciclo de violência", descricao: cyclePhases.join(", "), frequencia: "recorrente" });
  }

  // ── Cross-reference section: magistrate input vs AMPARA records ──
  const dados_magistrado_input = {
    vitima: dadosMagistradoInput?.dados_vitima || null,
    agressor: dadosMagistradoInput?.dados_agressor || null,
    processo: dadosMagistradoInput?.dados_processo || null,
  };

  const dados_ampara_registros = {
    vitima_encontrada: !!usuario,
    vitima: usuario ? {
      nome: usuario.nome_completo,
      cidade_uf: `${usuario.endereco_cidade || ""}/${usuario.endereco_uf || ""}`,
      mora_com_agressor: usuario.mora_com_agressor,
      tem_filhos: usuario.tem_filhos,
      cor_raca: usuario.cor_raca,
      escolaridade: usuario.escolaridade,
      profissao: usuario.profissao,
      data_nascimento: usuario.data_nascimento,
    } : null,
    agressor_encontrado: !!agressor,
    agressor: agressor ? {
      nome: agressor.nome,
      risk_score: agressor.risk_score,
      risk_level: agressor.risk_level,
      forca_seguranca: agressor.forca_seguranca,
      tem_arma: agressor.tem_arma_em_casa,
      cidade_uf: agressor.primary_city_uf,
      profissao: agressor.profession,
      cor_raca: agressor.cor_raca,
      escolaridade: agressor.escolaridade,
      data_nascimento: agressor.data_nascimento,
      aliases: agressor.aliases,
      xingamentos: agressor.xingamentos_frequentes,
      violence_profile: agressor.violence_profile_probs,
      flags: agressor.flags,
      last_incident_at: agressor.last_incident_at,
      neighborhoods: agressor.neighborhoods,
      vehicles: agressor.vehicles,
    } : null,
    historico_analises: {
      total_micro: microResults.length,
      niveis_risco_encontrados: [...new Set(riskLevels)],
      contextos: [...new Set(contextTypes)],
      fases_ciclo: cyclePhases,
      analises_alto_critico: riskLevels.filter((r: string) => r === "alto" || r === "critico").length,
    },
    avaliacao_risco_atual: riskAssessment ? {
      score: riskAssessment.risk_score,
      nivel: riskAssessment.risk_level,
      tendencia: riskAssessment.trend,
      resumo: riskAssessment.resumo_tecnico,
    } : null,
    total_gravacoes_processadas: amparaData.recordings_summary.length,
    total_relatorios_macro: amparaData.macro_reports.length,
    dados_externos_anteriores: amparaData.external_data.length,
  };

  return {
    dados_magistrado_input,
    dados_ampara_registros,
    risco: {
      score: riskAssessment?.risk_score ?? null,
      nivel: riskAssessment?.risk_level ?? "nao_avaliado",
      tendencia: riskAssessment?.trend ?? null,
      resumo_tecnico: riskAssessment?.resumo_tecnico ?? null,
    },
    indicadores,
    fatores,
    padroes,
    dados_vitima: usuario ? {
      cidade_uf: `${usuario.endereco_cidade || ""}/${usuario.endereco_uf || ""}`,
      mora_com_agressor: usuario.mora_com_agressor,
      tem_filhos: usuario.tem_filhos,
      cor_raca: usuario.cor_raca,
      escolaridade: usuario.escolaridade,
      profissao: usuario.profissao,
    } : null,
    dados_agressor: agressor ? {
      risk_score: agressor.risk_score,
      risk_level: agressor.risk_level,
      forca_seguranca: agressor.forca_seguranca,
      tem_arma: agressor.tem_arma_em_casa,
      cidade_uf: agressor.primary_city_uf,
      profissao: agressor.profession,
      xingamentos: agressor.xingamentos_frequentes,
      violence_profile: agressor.violence_profile_probs,
    } : null,
    total_micro_analyses: microResults.length,
    total_recordings: amparaData.recordings_summary.length,
    dados_processo: dadosProcesso ? {
      tipo: dadosProcesso.tipo,
      numero: dadosProcesso.numero,
      resumo: dadosProcesso.resumo,
      conteudo: dadosProcesso.conteudo,
    } : null,
  };
}

// ── AI call ──

async function callAI(prompt: string, dados: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `DADOS PARA ANÁLISE:\n${dados}` },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI gateway error:", response.status, errText);
    if (response.status === 429) throw new Error("Rate limit excedido. Tente novamente em instantes.");
    if (response.status === 402) throw new Error("Créditos de IA insuficientes.");
    throw new Error(`Erro no gateway de IA: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

// ── Handlers ──

async function generateOneMode(supabase: any, modo: string, analysisObject: any, prompt: string): Promise<{ modo: string; outputJson: any; outputText: string | null; error?: string }> {
  const dadosStr = JSON.stringify(analysisObject, null, 2);
  try {
    const aiOutput = await callAI(prompt, dadosStr);
    if (modo === "analitico") {
      let cleaned = aiOutput.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      try {
        return { modo, outputJson: JSON.parse(cleaned), outputText: null };
      } catch {
        return { modo, outputJson: { raw: aiOutput }, outputText: null };
      }
    }
    return { modo, outputJson: {}, outputText: aiOutput };
  } catch (e: any) {
    return { modo, outputJson: {}, outputText: null, error: e.message };
  }
}

function buildAmparaSummary(amparaData: any) {
  const micro = amparaData.micro_analyses || [];
  const macro = amparaData.macro_reports || [];
  const risk = amparaData.risk_assessments || [];
  const recs = amparaData.recordings_summary || [];
  const ext = amparaData.external_data || [];

  return {
    total_analises_micro: micro.length,
    analises_micro: micro.slice(0, 10).map((m: any) => ({
      risco: m.risk_level,
      contexto: m.context_classification,
      fase_ciclo: m.cycle_phase,
      data: m.created_at,
    })),
    total_relatorios_macro: macro.length,
    relatorios_macro: macro.slice(0, 3).map((m: any) => ({
      janela_dias: m.window_days,
      status: m.status,
      data: m.created_at,
      resumo: m.output_json?.resumo || m.output_json?.summary || null,
    })),
    total_avaliacoes_risco: risk.length,
    avaliacoes_risco: risk.slice(0, 3).map((r: any) => ({
      score: r.risk_score,
      nivel: r.risk_level,
      tendencia: r.trend,
      percentual_tendencia: r.trend_percentage,
      resumo_tecnico: r.resumo_tecnico,
      data: r.computed_at,
    })),
    total_gravacoes: recs.length,
    total_dados_externos: ext.length,
    dados_externos: ext.slice(0, 5).map((e: any) => ({
      tipo: e.tipo_dado,
      numero: e.numero_referencia,
      resumo: e.resumo,
      data: e.data_referencia || e.created_at,
    })),
  };
}

async function handleConsulta(supabase: any, auth: AuthResult, body: any) {
  // Find victim & aggressor
  const usuario = await findUsuario(supabase, body.dados_vitima);
  const agressor = await findAgressor(supabase, body.dados_agressor);

  // Gather AMPARA data (always include)
  const amparaData = await gatherAmparaData(supabase, usuario?.id || null, agressor?.id || null);

  // Build analysis object
  const analysisObject = buildAnalysisObject(amparaData, body.dados_processo, agressor, usuario, body);

  // Build AMPARA summary for display
  const amparaSummary = buildAmparaSummary(amparaData);

  // Build prompts for all 3 modes in parallel
  const [promptAnalitico, promptDespacho, promptParecer] = await Promise.all([
    buildPrompt(supabase, "analitico"),
    buildPrompt(supabase, "despacho"),
    buildPrompt(supabase, "parecer"),
  ]);

  // Generate all 3 analyses in parallel
  const [resAnalitico, resDespacho, resParecer] = await Promise.all([
    generateOneMode(supabase, "analitico", analysisObject, promptAnalitico.prompt),
    generateOneMode(supabase, "despacho", analysisObject, promptDespacho.prompt),
    generateOneMode(supabase, "parecer", analysisObject, promptParecer.prompt),
  ]);

  const allResults = [resAnalitico, resDespacho, resParecer];
  const hasAnySuccess = allResults.some(r => !r.error);

  if (!hasAnySuccess) {
    await supabase.from("tribunal_consultas").insert({
      tenant_id: auth.tenantId,
      api_key_id: auth.apiKeyId,
      modo_saida: "todos",
      analysis_object: analysisObject,
      status: "error",
      error_message: allResults.map(r => `${r.modo}: ${r.error}`).join("; "),
      usuario_id: usuario?.id || null,
      agressor_id: agressor?.id || null,
      model: "google/gemini-2.5-pro",
      prompt_version: `${promptAnalitico.version}|${promptDespacho.version}|${promptParecer.version}`,
      created_by: auth.userId,
    });
    return json({ error: resAnalitico.error || "Erro ao gerar análises" }, 500);
  }

  // Save consulta with all outputs
  const { data: consulta, error: insertError } = await supabase
    .from("tribunal_consultas")
    .insert({
      tenant_id: auth.tenantId,
      api_key_id: auth.apiKeyId,
      modo_saida: "todos",
      analysis_object: analysisObject,
      output_json: {
        analitico: resAnalitico.error ? { error: resAnalitico.error } : resAnalitico.outputJson,
        despacho: resDespacho.error ? { error: resDespacho.error } : null,
        parecer: resParecer.error ? { error: resParecer.error } : null,
      },
      output_text: JSON.stringify({
        despacho: resDespacho.outputText,
        parecer: resParecer.outputText,
      }),
      usuario_id: usuario?.id || null,
      agressor_id: agressor?.id || null,
      model: "google/gemini-2.5-pro",
      prompt_version: `${promptAnalitico.version}|${promptDespacho.version}|${promptParecer.version}`,
      status: "success",
      created_by: auth.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return json({ error: "Erro ao salvar consulta" }, 500);
  }

  // Save external data linked to consulta
  if (body.dados_processo && consulta) {
    await supabase.from("tribunal_dados_externos").insert({
      consulta_id: consulta.id,
      tenant_id: auth.tenantId,
      tipo_dado: body.dados_processo.tipo || "outro",
      numero_referencia: body.dados_processo.numero || null,
      resumo: body.dados_processo.resumo || null,
      dados_json: body.dados_processo,
      usuario_id: usuario?.id || null,
      agressor_id: agressor?.id || null,
      data_referencia: body.dados_processo.data_referencia || null,
    });
  }

  return json({
    success: true,
    consulta_id: consulta?.id,
    vitima_vinculada: !!usuario,
    agressor_vinculado: !!agressor,
    ampara_summary: amparaSummary,
    resultados: {
      analitico: resAnalitico.error ? { error: resAnalitico.error } : { analise: resAnalitico.outputJson },
      despacho: resDespacho.error ? { error: resDespacho.error } : { texto: resDespacho.outputText },
      parecer: resParecer.error ? { error: resParecer.error } : { texto: resParecer.outputText },
    },
  });
}

async function handleListConsultas(supabase: any, auth: AuthResult, body: any) {
  const page = body.page || 1;
  const limit = Math.min(body.limit || 20, 50);
  const offset = (page - 1) * limit;

  let query = supabase
    .from("tribunal_consultas")
    .select("id, modo_saida, status, created_at, usuario_id, agressor_id, prompt_version, model, tenant_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (auth.tenantId) query = query.eq("tenant_id", auth.tenantId);
  if (body.modo_saida) query = query.eq("modo_saida", body.modo_saida);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 500);

  return json({ success: true, consultas: data || [], total: count || 0, page, limit });
}

async function handleGetConsulta(supabase: any, auth: AuthResult, body: any) {
  if (!body.consulta_id) return json({ error: "consulta_id obrigatório" }, 400);

  let query = supabase
    .from("tribunal_consultas")
    .select("*")
    .eq("id", body.consulta_id);
  if (auth.tenantId) query = query.eq("tenant_id", auth.tenantId);

  const { data, error } = await query.maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Consulta não encontrada" }, 404);

  // Also fetch external data
  const { data: extData } = await supabase
    .from("tribunal_dados_externos")
    .select("*")
    .eq("consulta_id", body.consulta_id);

  return json({ success: true, consulta: data, dados_externos: extData || [] });
}

async function handleRegenerar(supabase: any, auth: AuthResult, body: any) {
  if (!body.consulta_id) return json({ error: "consulta_id obrigatório" }, 400);
  const novoModo = body.modo_saida;
  if (!novoModo || !["analitico", "despacho", "parecer"].includes(novoModo))
    return json({ error: "modo_saida obrigatório (analitico, despacho, parecer)" }, 400);

  // Fetch original consulta
  let query = supabase
    .from("tribunal_consultas")
    .select("analysis_object, usuario_id, agressor_id, tenant_id")
    .eq("id", body.consulta_id);
  if (auth.tenantId) query = query.eq("tenant_id", auth.tenantId);

  const { data: original } = await query.maybeSingle();
  if (!original) return json({ error: "Consulta original não encontrada" }, 404);

  // Re-use analysis_object, just change output mode
  const { prompt, version } = await buildPrompt(supabase, novoModo);
  const dadosStr = JSON.stringify(original.analysis_object, null, 2);

  let aiOutput: string;
  try {
    aiOutput = await callAI(prompt, dadosStr);
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }

  let outputJson: any = {};
  let outputText: string | null = null;
  if (novoModo === "analitico") {
    try {
      let cleaned = aiOutput.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      outputJson = JSON.parse(cleaned);
    } catch { outputJson = { raw: aiOutput }; }
  } else {
    outputText = aiOutput;
  }

  const { data: nova, error } = await supabase
    .from("tribunal_consultas")
    .insert({
      tenant_id: original.tenant_id,
      api_key_id: auth.apiKeyId,
      modo_saida: novoModo,
      analysis_object: original.analysis_object,
      output_json: outputJson,
      output_text: outputText,
      usuario_id: original.usuario_id,
      agressor_id: original.agressor_id,
      model: "google/gemini-2.5-pro",
      prompt_version: version,
      status: "success",
      created_by: auth.userId,
    })
    .select("id")
    .single();

  if (error) return json({ error: error.message }, 500);

  const response: any = { success: true, consulta_id: nova?.id, modo_saida: novoModo };
  if (novoModo === "analitico") response.analise = outputJson;
  else response.texto = outputText;
  return json(response);
}

// ── Prompt management (admin only) ──

async function handleListPrompts(supabase: any) {
  const { data, error } = await supabase
    .from("tribunal_prompts")
    .select("*")
    .order("tipo")
    .order("versao", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, prompts: data || [] });
}

async function handleSavePrompt(supabase: any, auth: AuthResult, body: any) {
  if (auth.via !== "session" || auth.isMagistrado) return json({ error: "Apenas admin pode gerenciar prompts" }, 403);
  const { tipo, conteudo } = body;
  if (!tipo || !conteudo) return json({ error: "tipo e conteudo obrigatórios" }, 400);
  if (!["base", "analitico", "despacho", "parecer"].includes(tipo))
    return json({ error: "tipo inválido" }, 400);

  // Get next version
  const { data: latest } = await supabase
    .from("tribunal_prompts")
    .select("versao")
    .eq("tipo", tipo)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.versao || 0) + 1;

  // Deactivate current active
  await supabase
    .from("tribunal_prompts")
    .update({ ativo: false })
    .eq("tipo", tipo)
    .eq("ativo", true);

  // Insert new
  const { data, error } = await supabase
    .from("tribunal_prompts")
    .insert({
      tipo,
      conteudo,
      versao: nextVersion,
      ativo: true,
      created_by: auth.userId,
    })
    .select("id, tipo, versao")
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ success: true, prompt: data });
}

async function handleActivatePrompt(supabase: any, auth: AuthResult, body: any) {
  if (auth.via !== "session" || auth.isMagistrado) return json({ error: "Apenas admin" }, 403);
  if (!body.prompt_id) return json({ error: "prompt_id obrigatório" }, 400);

  const { data: prompt } = await supabase
    .from("tribunal_prompts")
    .select("tipo")
    .eq("id", body.prompt_id)
    .maybeSingle();
  if (!prompt) return json({ error: "Prompt não encontrado" }, 404);

  // Deactivate all of same type
  await supabase
    .from("tribunal_prompts")
    .update({ ativo: false })
    .eq("tipo", prompt.tipo);

  // Activate selected
  await supabase
    .from("tribunal_prompts")
    .update({ ativo: true })
    .eq("id", body.prompt_id);

  return json({ success: true });
}

// ── API Key management ──

async function handleCreateApiKey(supabase: any, auth: AuthResult, body: any) {
  if (auth.via !== "session" || auth.isMagistrado) return json({ error: "Apenas admin" }, 403);
  if (!body.tenant_id || !body.label) return json({ error: "tenant_id e label obrigatórios" }, 400);

  // Generate key
  const rawKey = `trib_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyHash = await sha256(rawKey);
  const keyPrefix = rawKey.substring(0, 12);

  const { data, error } = await supabase
    .from("tribunal_api_keys")
    .insert({
      tenant_id: body.tenant_id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label: body.label,
      expires_at: body.expires_at || null,
    })
    .select("id, key_prefix, label, created_at")
    .single();

  if (error) return json({ error: error.message }, 500);

  // Return raw key ONLY on creation
  return json({ success: true, api_key: rawKey, key_data: data });
}

async function handleListApiKeys(supabase: any) {
  const { data, error } = await supabase
    .from("tribunal_api_keys")
    .select("id, tenant_id, key_prefix, label, ativo, created_at, expires_at, tenants(nome, sigla)")
    .order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, keys: data || [] });
}

async function handleToggleApiKey(supabase: any, auth: AuthResult, body: any) {
  if (auth.via !== "session" || auth.isMagistrado) return json({ error: "Apenas admin" }, 403);
  if (!body.key_id) return json({ error: "key_id obrigatório" }, 400);

  const { data: key } = await supabase
    .from("tribunal_api_keys")
    .select("ativo")
    .eq("id", body.key_id)
    .maybeSingle();
  if (!key) return json({ error: "Chave não encontrada" }, 404);

  await supabase
    .from("tribunal_api_keys")
    .update({ ativo: !key.ativo })
    .eq("id", body.key_id);

  return json({ success: true, ativo: !key.ativo });
}

// ── Search handlers ──

async function handleSearchVitima(supabase: any, _auth: AuthResult, body: any) {
  const { nome, telefone, cpf } = body;
  if (!nome && !telefone && !cpf) return json({ error: "Informe ao menos um campo: nome, telefone ou CPF" }, 400);

  let query = supabase.from("usuarios").select("id, nome_completo, email, telefone, endereco_cidade, endereco_uf, cor_raca, escolaridade, profissao, mora_com_agressor, tem_filhos, data_nascimento, status, cpf_last4");
  if (nome) query = query.ilike("nome_completo", `%${nome}%`);
  if (telefone) query = query.ilike("telefone", `%${telefone}%`);
  if (cpf) {
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length === 4) {
      query = query.eq("cpf_last4", cpfDigits);
    } else if (cpfDigits.length === 11) {
      query = query.eq("cpf_last4", cpfDigits.slice(-4));
    } else {
      query = query.eq("cpf_last4", cpfDigits.slice(-4));
    }
  }
  const { data, error } = await query.limit(10);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, vitimas: data || [] });
}

async function handleSearchAgressor(supabase: any, _auth: AuthResult, body: any) {
  const { nome, cpf_last4 } = body;
  if (!nome && !cpf_last4) return json({ error: "Informe ao menos um campo: nome ou CPF (últimos 4)" }, 400);

  let query = supabase.from("agressores").select("id, nome, display_name_masked, risk_score, risk_level, forca_seguranca, tem_arma_em_casa, primary_city_uf, profession, aliases, cor_raca, escolaridade, data_nascimento, cpf_last4, last_incident_at, quality_score, neighborhoods, xingamentos_frequentes");
  if (cpf_last4) query = query.eq("cpf_last4", cpf_last4);
  if (nome) query = query.ilike("nome", `%${nome}%`);
  const { data, error } = await query.order("quality_score", { ascending: false }).limit(10);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true, agressores: data || [] });
}

async function handleGetAgressoresVinculados(supabase: any, _auth: AuthResult, body: any) {
  const { usuario_id } = body;
  if (!usuario_id) return json({ error: "usuario_id obrigatório" }, 400);

  const { data: vinculos, error } = await supabase
    .from("vitimas_agressores")
    .select("agressor_id, tipo_vinculo, status_relacao")
    .eq("usuario_id", usuario_id);
  if (error) return json({ error: error.message }, 500);
  if (!vinculos || vinculos.length === 0) return json({ success: true, agressores: [] });

  const ids = vinculos.map((v: any) => v.agressor_id);
  const { data: agressores } = await supabase
    .from("agressores")
    .select("id, nome, display_name_masked, risk_score, risk_level, forca_seguranca, tem_arma_em_casa, primary_city_uf, profession, aliases, cor_raca, escolaridade, data_nascimento, cpf_last4, last_incident_at, quality_score, neighborhoods, xingamentos_frequentes")
    .in("id", ids);

  const enriched = (agressores || []).map((a: any) => {
    const v = vinculos.find((v: any) => v.agressor_id === a.id);
    return { ...a, tipo_vinculo: v?.tipo_vinculo, status_relacao: v?.status_relacao };
  });

  return json({ success: true, agressores: enriched });
}

// ── Main ──

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const authResult = await authenticateRequest(supabase, req, body);
    if (authResult instanceof Response) return authResult;
    const auth = authResult;

    switch (action) {
      case "consulta":
        return await handleConsulta(supabase, auth, body);
      case "listConsultas":
        return await handleListConsultas(supabase, auth, body);
      case "getConsulta":
        return await handleGetConsulta(supabase, auth, body);
      case "regenerar":
        return await handleRegenerar(supabase, auth, body);
      case "listPrompts":
        return await handleListPrompts(supabase);
      case "savePrompt":
        return await handleSavePrompt(supabase, auth, body);
      case "activatePrompt":
        return await handleActivatePrompt(supabase, auth, body);
      case "createApiKey":
        return await handleCreateApiKey(supabase, auth, body);
      case "listApiKeys":
        return await handleListApiKeys(supabase);
      case "toggleApiKey":
        return await handleToggleApiKey(supabase, auth, body);
      case "searchVitima":
        return await handleSearchVitima(supabase, auth, body);
      case "searchAgressor":
        return await handleSearchAgressor(supabase, auth, body);
      case "getAgressoresVinculados":
        return await handleGetAgressoresVinculados(supabase, auth, body);
      default:
        return json({ error: `Action desconhecida: ${action}` }, 400);
    }
  } catch (e: any) {
    console.error("tribunal-api error:", e);
    return json({ error: e.message || "Erro interno" }, 500);
  }
});
