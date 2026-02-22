import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.4";

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

const R2_PUBLIC_URL = () => Deno.env.get("R2_PUBLIC_URL") || "";

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

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
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

// ========== AI RANKING HELPER ==========
async function rankCandidatesWithAI(searchInput: any, candidates: any[]) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `Você é um módulo de análise forense de perfis para proteção de mulheres contra violência doméstica.
Dado os critérios de busca da usuária e uma lista de candidatos do banco de dados, você deve:
1. Pontuar cada candidato (0-100) com base nos pesos:
   - Contato parcial: DDD bate +10, final 4 dígitos +25, 2-3 dígitos +10
   - Nome muito similar +25, só primeiro nome +12, apelido similar +12
   - Pai/mãe primeiro nome bate +10 cada, parcial similar +15 cada
   - Cidade/UF bate +18, bairro +10, referência +6
   - Profissão/setor +10
   - Placa parcial forte +18, cor/modelo +8
   - Conflitos fortes: -25 a -40
2. Converter score em probabilidade (max 99%): >=85→90-99%, 70-84→70-89%, 55-69→50-69%, 40-54→30-49%, 25-39→15-29%, <25→<15%
3. Para cada candidato, listar match_breakdown com status (completo/parcial/nao_bateu/conflitante)
4. Calcular risk_level (Baixo/Médio/Alto/Crítico) e violence_probabilities com base nos incidents
5. Retornar os top 10 ordenados por probabilidade

RETORNE APENAS JSON válido com a estrutura:
{
  "results": [{
    "profile_id": "uuid",
    "display_name_masked": "string",
    "location_summary": "string",
    "probability_percent": number,
    "match_breakdown": [{"field": "string", "status": "completo|parcial|nao_bateu|conflitante", "user_value_masked": "string", "candidate_value_masked": "string", "similarity": number}],
    "strong_signals": ["string"],
    "weak_signals": ["string"],
    "conflicts": ["string"],
    "risk_level": "Baixo|Médio|Alto|Crítico",
    "violence_probabilities": {"psicologica": number, "moral": number, "patrimonial": number, "fisica": number, "sexual": number, "ameaca_perseguicao": number},
    "explanation_short": "string",
    "guidance": ["string"]
  }],
  "query_summary": {}
}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ search_input: searchInput, candidates }) },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) content = jsonMatch[1];
  
  try {
    const parsed = JSON.parse(content.trim());
    parsed.query_summary = searchInput;
    return parsed;
  } catch (e) {
    console.error("Failed to parse AI response:", content);
    throw new Error("Failed to parse AI ranking response");
  }
}

// ========== RECALCULATE AGGRESSOR RISK ==========
async function recalculateAgressorRisk(supabase: any, agressorId: string) {
  const { data: incidents } = await supabase
    .from("aggressor_incidents")
    .select("violence_types, severity, occurred_at_month, pattern_tags, confidence")
    .eq("aggressor_id", agressorId)
    .order("occurred_at_month", { ascending: false });

  if (!incidents || incidents.length === 0) {
    await supabase.from("agressores").update({
      risk_score: 0, risk_level: "baixo",
      violence_profile_probs: {}, flags: [],
    }).eq("id", agressorId);
    return;
  }

  const typeCounts: Record<string, { count: number; totalSev: number; recent: boolean }> = {};
  const now = new Date();
  let maxSeverity = 0;
  let recentHighSeverity = false;
  const patternSet = new Set<string>();

  for (const inc of incidents) {
    const monthDiff = inc.occurred_at_month ? 
      (now.getFullYear() * 12 + now.getMonth()) - 
      (parseInt(inc.occurred_at_month.split("-")[0]) * 12 + parseInt(inc.occurred_at_month.split("-")[1]) - 1) : 12;
    const isRecent = monthDiff <= 6;
    for (const vt of (inc.violence_types || [])) {
      if (!typeCounts[vt]) typeCounts[vt] = { count: 0, totalSev: 0, recent: false };
      typeCounts[vt].count++;
      typeCounts[vt].totalSev += inc.severity || 3;
      if (isRecent) typeCounts[vt].recent = true;
    }
    if (inc.severity > maxSeverity) maxSeverity = inc.severity;
    if (isRecent && inc.severity >= 4) recentHighSeverity = true;
    for (const pt of (inc.pattern_tags || [])) patternSet.add(pt);
  }

  const totalIncidents = incidents.length;
  const violenceProbs: Record<string, number> = {};
  for (const [type, data] of Object.entries(typeCounts)) {
    const freq = data.count / totalIncidents;
    const sevFactor = data.totalSev / (data.count * 5);
    const recencyBoost = data.recent ? 1.3 : 0.8;
    violenceProbs[type] = Math.min(99, Math.round(freq * sevFactor * recencyBoost * 100));
  }

  let riskScore = Math.min(100, totalIncidents * 8 + maxSeverity * 10);
  if (recentHighSeverity) riskScore = Math.min(100, riskScore + 20);
  if (patternSet.has("perseguicao") || patternSet.has("stalking")) riskScore = Math.min(100, riskScore + 15);
  if (patternSet.has("ameaca")) riskScore = Math.min(100, riskScore + 10);

  const riskLevel = riskScore >= 80 ? "critico" : riskScore >= 55 ? "alto" : riskScore >= 30 ? "medio" : "baixo";

  const flags: string[] = [];
  if (totalIncidents >= 3) flags.push("reincidente");
  if (recentHighSeverity) flags.push("escalada");
  if (patternSet.has("perseguicao") || patternSet.has("stalking")) flags.push("stalking");
  if (totalIncidents > 1) flags.push("multi-relatos");

  const lastIncident = incidents[0]?.occurred_at_month ? 
    new Date(incidents[0].occurred_at_month + "-01").toISOString() : null;

  await supabase.from("agressores").update({
    risk_score: riskScore, risk_level: riskLevel,
    violence_profile_probs: violenceProbs, flags,
    last_incident_at: lastIncident,
  }).eq("id", agressorId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle audio proxy via query params (GET request for streaming audio)
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "proxyAudio") {
      const sessionToken = url.searchParams.get("session_token") || "";
      const storagePath = url.searchParams.get("storage_path") || "";
      
      const proxyUserId = await authenticateSession(supabase, sessionToken);
      if (!proxyUserId) {
        return json({ error: "Sessão inválida" }, 401);
      }
      if (!storagePath) {
        return json({ error: "storage_path obrigatório" }, 400);
      }

      // Verify ownership
      const { data: rec } = await supabase
        .from("gravacoes")
        .select("id")
        .eq("user_id", proxyUserId)
        .eq("storage_path", storagePath)
        .maybeSingle();
      if (!rec) {
        const { data: seg } = await supabase
          .from("gravacoes_segmentos")
          .select("id")
          .eq("user_id", proxyUserId)
          .eq("storage_path", storagePath)
          .maybeSingle();
        if (!seg) return json({ error: "Não encontrado" }, 404);
      }

      // Fetch audio — autogerado paths come from Supabase Storage, others from R2
      try {
        const contentType = storagePath.endsWith(".wav") ? "audio/wav"
          : storagePath.endsWith(".ogg") ? "audio/ogg"
          : "audio/mpeg";

        if (storagePath.startsWith("autogerado/")) {
          // Serve from Supabase Storage using service-role signed URL
          const serviceSupabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          const { data: signedData, error: signErr } = await serviceSupabase.storage
            .from("audio-recordings")
            .createSignedUrl(storagePath, 3600);

          if (signErr || !signedData?.signedUrl) {
            console.error("Signed URL error:", signErr);
            return json({ error: "Erro ao gerar URL do áudio" }, 502);
          }

          const storageResp = await fetch(signedData.signedUrl);
          if (!storageResp.ok) {
            console.error("Storage fetch error:", storageResp.status, storageResp.statusText);
            return json({ error: "Erro ao buscar áudio do storage" }, 502);
          }

          return new Response(storageResp.body, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": contentType,
              "Cache-Control": "private, max-age=3600",
            },
          });
        } else {
          // Serve from R2
          const r2 = getR2Client();
          const r2FullUrl = r2Url(storagePath);
          const signed = await r2.sign(r2FullUrl, { method: "GET" });
          const r2Resp = await fetch(signed.url, { headers: signed.headers });
          if (!r2Resp.ok) {
            console.error("R2 fetch error:", r2Resp.status, storagePath);
            return json({ error: "Erro ao buscar áudio do storage" }, 502);
          }

          return new Response(r2Resp.body, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": contentType,
              "Cache-Control": "private, max-age=3600",
            },
          });
        }
      } catch (e) {
        console.error("Audio proxy error:", e);
        return json({ error: "Erro ao proxy áudio" }, 500);
      }
    }

    const body = await req.json();
    const { action, session_token, ...params } = body;

    const userId = await authenticateSession(supabase, session_token);
    if (!userId) {
      return json({ error: "Sessão inválida ou expirada" }, 401);
    }

    switch (action) {
      // ========== VÍTIMA ==========
      case "getMe": {
        const { data } = await supabase
          .from("usuarios")
          .select("id, nome_completo, email, telefone, data_nascimento, endereco_fixo, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_referencia, tem_filhos, mora_com_agressor, onboarding_completo, avatar_url, retencao_dias_sem_risco, compartilhar_gps_panico, compartilhar_gps_risco_alto, gps_duracao_minutos, cor_raca, escolaridade, profissao")
          .eq("id", userId)
          .single();
        return json({ success: true, usuario: data });
      }

      case "updateMe": {
        const allowed = ["nome_completo", "telefone", "data_nascimento", "endereco_fixo", "endereco_cep", "endereco_logradouro", "endereco_numero", "endereco_complemento", "endereco_bairro", "endereco_cidade", "endereco_uf", "endereco_referencia", "tem_filhos", "mora_com_agressor", "onboarding_completo", "avatar_url", "retencao_dias_sem_risco", "compartilhar_gps_panico", "compartilhar_gps_risco_alto", "gps_duracao_minutos", "cor_raca", "escolaridade", "profissao"];
        const updates: Record<string, any> = {};
        for (const key of allowed) {
          if (params[key] !== undefined) updates[key] = params[key];
        }
        if (Object.keys(updates).length === 0) {
          return json({ error: "Nenhum campo para atualizar" }, 400);
        }
        const { error } = await supabase
          .from("usuarios")
          .update(updates)
          .eq("id", userId);
        if (error) return json({ error: "Erro ao atualizar perfil" }, 500);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "profile_updated", success: true,
          details: { fields: Object.keys(updates) },
        });
        return json({ success: true });
      }

      // ========== GUARDIÕES ==========
      case "getGuardioes": {
        const { data } = await supabase
          .from("guardioes")
          .select("id, nome, vinculo, telefone_whatsapp, created_at")
          .eq("usuario_id", userId)
          .order("created_at", { ascending: true });
        return json({ success: true, guardioes: data || [] });
      }

      case "createGuardiao": {
        const { nome, vinculo, telefone_whatsapp } = params;
        if (!nome?.trim() || !vinculo?.trim() || !telefone_whatsapp?.trim()) {
          return json({ error: "Nome, vínculo e telefone são obrigatórios" }, 400);
        }
        const { data, error } = await supabase
          .from("guardioes")
          .insert({ usuario_id: userId, nome: nome.trim(), vinculo: vinculo.trim(), telefone_whatsapp: telefone_whatsapp.replace(/\D/g, "") })
          .select("id")
          .single();
        if (error) return json({ error: "Erro ao criar guardião" }, 500);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "guardiao_created", success: true,
          details: { guardiao_id: data.id },
        });
        return json({ success: true, id: data.id }, 201);
      }

      case "updateGuardiao": {
        const { guardiao_id, ...guardiaoUpdates } = params;
        if (!guardiao_id) return json({ error: "guardiao_id obrigatório" }, 400);

        // Verify ownership
        const { data: existing } = await supabase
          .from("guardioes")
          .select("id")
          .eq("id", guardiao_id)
          .eq("usuario_id", userId)
          .maybeSingle();
        if (!existing) return json({ error: "Guardião não encontrado" }, 404);

        const allowed = ["nome", "vinculo", "telefone_whatsapp"];
        const upd: Record<string, any> = {};
        for (const k of allowed) {
          if (guardiaoUpdates[k] !== undefined) upd[k] = guardiaoUpdates[k];
        }
        if (upd.telefone_whatsapp) upd.telefone_whatsapp = upd.telefone_whatsapp.replace(/\D/g, "");

        await supabase.from("guardioes").update(upd).eq("id", guardiao_id);
        return json({ success: true });
      }

      case "deleteGuardiao": {
        const { guardiao_id } = params;
        if (!guardiao_id) return json({ error: "guardiao_id obrigatório" }, 400);

        const { data: existing } = await supabase
          .from("guardioes")
          .select("id")
          .eq("id", guardiao_id)
          .eq("usuario_id", userId)
          .maybeSingle();
        if (!existing) return json({ error: "Guardião não encontrado" }, 404);

        await supabase.from("guardioes").delete().eq("id", guardiao_id);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "guardiao_deleted", success: true,
          details: { guardiao_id },
        });
        return json({ success: true });
      }

      // ========== AGRESSOR ==========
      case "searchAgressor": {
        const { query } = params;
        if (!query || query.trim().length < 3) {
          return json({ error: "Query deve ter no mínimo 3 caracteres" }, 400);
        }

        const q = query.trim();
        const phoneDigits = q.replace(/\D/g, "");

        let results: any[] = [];

        // Search by phone if query looks like a phone number
        if (phoneDigits.length >= 8) {
          const { data } = await supabase
            .from("agressores")
            .select("id, nome, data_nascimento, forca_seguranca, tem_arma_em_casa")
            .ilike("telefone", `%${phoneDigits}%`)
            .limit(10);
          results = data || [];
        } else {
          // Search by name
          const { data } = await supabase
            .from("agressores")
            .select("id, nome, data_nascimento, forca_seguranca, tem_arma_em_casa")
            .ilike("nome", `%${q}%`)
            .limit(10);
          results = data || [];
        }

        // Anonymize results: partial name, year only, count of links
        const anonymized = await Promise.all(results.map(async (a) => {
          const { count } = await supabase
            .from("vitimas_agressores")
            .select("id", { count: "exact", head: true })
            .eq("agressor_id", a.id);

          // Mask name: "João Silva" → "J*** S***"
          const maskedName = a.nome.split(" ").map((w: string) =>
            w.length <= 1 ? w : w[0] + "*".repeat(Math.min(w.length - 1, 3))
          ).join(" ");

          return {
            id: a.id,
            nome_parcial: maskedName,
            ano_nascimento: a.data_nascimento ? new Date(a.data_nascimento).getFullYear() : null,
            forca_seguranca: a.forca_seguranca,
            tem_arma_em_casa: a.tem_arma_em_casa,
            total_vinculos: count || 0,
          };
        }));

        return json({ success: true, resultados: anonymized });
      }

      // ========== BUSCA AVANÇADA DE PERFIL (PRIVACY-FIRST) ==========
      case "searchAgressorAdvanced": {
        const {
          nome, apelido, idade_aprox,
          nome_pai, nome_mae,
          ddd, final_telefone,
          cidade_uf, bairro,
          profissao,
          placa_parcial,
        } = params;

        // Need at least one search parameter
        const hasAny = [nome, apelido, nome_pai, nome_mae, ddd, final_telefone, cidade_uf, bairro, profissao, placa_parcial].some(v => v && String(v).trim());
        if (!hasAny) {
          return json({ error: "Forneça pelo menos um critério de busca" }, 400);
        }

        // Phase A: SQL recall via the search_agressor_candidates function
        const { data: candidates, error: searchErr } = await supabase.rpc("search_agressor_candidates", {
          p_name: nome?.trim() || null,
          p_alias: apelido?.trim() || null,
          p_father_first: nome_pai?.trim() || null,
          p_mother_first: nome_mae?.trim() || null,
          p_ddd: ddd?.trim() || null,
          p_phone_last_digits: final_telefone?.trim() || null,
          p_city_uf: cidade_uf?.trim() || null,
          p_neighborhood: bairro?.trim() || null,
          p_profession: profissao?.trim() || null,
          p_plate_prefix: placa_parcial?.trim() || null,
          p_age_approx: idade_aprox ? parseInt(String(idade_aprox)) : null,
        });

        if (searchErr) {
          console.error("Search error:", searchErr);
          return json({ error: "Erro na busca" }, 500);
        }

        if (!candidates || candidates.length === 0) {
          return json({ success: true, results: [], query_summary: params });
        }

        // Get incidents for all candidates
        const candidateIds = candidates.map((c: any) => c.id);
        const { data: allIncidents } = await supabase
          .from("aggressor_incidents")
          .select("aggressor_id, violence_types, severity, occurred_at_month, pattern_tags, confidence")
          .in("aggressor_id", candidateIds);

        const incidentsByAggressor: Record<string, any[]> = {};
        for (const inc of (allIncidents || [])) {
          if (!incidentsByAggressor[inc.aggressor_id]) incidentsByAggressor[inc.aggressor_id] = [];
          incidentsByAggressor[inc.aggressor_id].push(inc);
        }

        // Phase B: AI ranking with Gemini
        const searchInput = {
          nome: nome?.trim() || null,
          apelido: apelido?.trim() || null,
          idade_aprox: idade_aprox || null,
          nome_pai: nome_pai?.trim() || null,
          nome_mae: nome_mae?.trim() || null,
          ddd: ddd?.trim() || null,
          final_telefone: final_telefone?.trim() || null,
          cidade_uf: cidade_uf?.trim() || null,
          bairro: bairro?.trim() || null,
          profissao: profissao?.trim() || null,
          placa_parcial: placa_parcial?.trim() || null,
        };

        // Prepare candidate summaries for AI (privacy-safe)
        const candidateSummaries = candidates.slice(0, 50).map((c: any) => ({
          id: c.id,
          display_name_masked: c.display_name_masked,
          name_normalized: c.name_normalized,
          aliases: c.aliases || [],
          data_nascimento_year: c.data_nascimento ? new Date(c.data_nascimento).getFullYear() : null,
          approx_age_min: c.approx_age_min,
          approx_age_max: c.approx_age_max,
          father_first_name: c.father_first_name,
          mother_first_name: c.mother_first_name,
          primary_city_uf: c.primary_city_uf,
          neighborhoods: c.neighborhoods || [],
          profession: c.profession,
          sector: c.sector,
          phone_clues: c.phone_clues || [],
          vehicles: c.vehicles || [],
          forca_seguranca: c.forca_seguranca,
          tem_arma_em_casa: c.tem_arma_em_casa,
          risk_score: c.risk_score,
          risk_level: c.risk_level,
          violence_profile_probs: c.violence_profile_probs,
          flags: c.flags || [],
          appearance_tags: c.appearance_tags || [],
          total_vinculos: c.total_vinculos,
          name_similarity: c.name_similarity,
          incidents: (incidentsByAggressor[c.id] || []).map((i: any) => ({
            violence_types: i.violence_types,
            severity: i.severity,
            occurred_at_month: i.occurred_at_month,
            pattern_tags: i.pattern_tags,
          })),
        }));

        try {
          const aiResult = await rankCandidatesWithAI(searchInput, candidateSummaries);
          return json({ success: true, ...aiResult });
        } catch (e) {
          console.error("AI ranking error, falling back to SQL scoring:", e);
          // Fallback: return SQL-scored results without AI
          const fallbackResults = candidates.slice(0, 10).map((c: any) => {
            const score = Math.min(99, Math.round((c.name_similarity || 0) * 60 + (c.quality_score || 0) * 0.4));
            const prob = score >= 85 ? Math.min(99, 90 + Math.round(score - 85)) :
                         score >= 70 ? 70 + Math.round((score - 70) * 1.3) :
                         score >= 55 ? 50 + Math.round((score - 55) * 1.3) :
                         score >= 40 ? 30 + Math.round((score - 40) * 1.3) :
                         score >= 25 ? 15 + Math.round((score - 25) * 1) :
                         Math.max(5, score);
            return {
              profile_id: c.id,
              display_name_masked: c.display_name_masked || "Desconhecido",
              location_summary: [c.primary_city_uf, (c.neighborhoods || [])[0]].filter(Boolean).join(", "),
              probability_percent: Math.min(99, prob),
              match_breakdown: [],
              strong_signals: [],
              weak_signals: [],
              conflicts: [],
              risk_level: c.risk_level || "Baixo",
              violence_probabilities: c.violence_profile_probs || {},
              explanation_short: "Ranking calculado sem IA (fallback).",
              guidance: ["Adicione mais dados para refinar a busca"],
            };
          });
          return json({ success: true, results: fallbackResults, query_summary: searchInput });
        }
      }

      case "createAgressor": {
        const {
          nome, data_nascimento, telefone, nome_pai_parcial, nome_mae_parcial,
          forca_seguranca, tem_arma_em_casa, tipo_vinculo,
          // New privacy-first fields
          aliases, approx_age_min, approx_age_max,
          primary_city_uf, neighborhoods, reference_points, geo_area_tags,
          profession, sector, company_public,
          vehicles, appearance_tags,
          phone_clues, email_clues,
          // Incident data (optional first report)
          incident,
        } = params;
        if (!nome?.trim()) return json({ error: "Nome do agressor é obrigatório" }, 400);
        if (!tipo_vinculo?.trim()) return json({ error: "Tipo de vínculo é obrigatório" }, 400);

        // Create aggressor record with expanded fields
        const insertData: Record<string, any> = {
          nome: nome.trim(),
          data_nascimento: data_nascimento || null,
          telefone: telefone ? telefone.replace(/\D/g, "") : null,
          nome_pai_parcial: nome_pai_parcial?.trim() || null,
          nome_mae_parcial: nome_mae_parcial?.trim() || null,
          forca_seguranca: forca_seguranca || false,
          tem_arma_em_casa: tem_arma_em_casa || false,
        };

        // Add new privacy-first fields if provided
        if (aliases?.length) insertData.aliases = aliases;
        if (approx_age_min) insertData.approx_age_min = approx_age_min;
        if (approx_age_max) insertData.approx_age_max = approx_age_max;
        if (primary_city_uf) insertData.primary_city_uf = primary_city_uf.trim();
        if (neighborhoods?.length) insertData.neighborhoods = neighborhoods;
        if (reference_points?.length) insertData.reference_points = reference_points;
        if (geo_area_tags?.length) insertData.geo_area_tags = geo_area_tags;
        if (profession) insertData.profession = profession.trim();
        if (sector) insertData.sector = sector.trim();
        if (company_public) insertData.company_public = company_public.trim();
        if (vehicles?.length) insertData.vehicles = vehicles;
        
        if (appearance_tags?.length) insertData.appearance_tags = appearance_tags;
        if (phone_clues?.length) insertData.phone_clues = phone_clues;
        if (email_clues?.length) insertData.email_clues = email_clues;
        if (params.cor_raca) insertData.cor_raca = params.cor_raca.trim();
        if (params.escolaridade) insertData.escolaridade = params.escolaridade.trim();

        const { data: agressor, error: aErr } = await supabase
          .from("agressores")
          .insert(insertData)
          .select("id")
          .single();

        if (aErr) {
          console.error("Create agressor error:", aErr);
          return json({ error: "Erro ao criar ficha do agressor" }, 500);
        }

        // Create link
        const { error: lErr } = await supabase
          .from("vitimas_agressores")
          .insert({
            usuario_id: userId,
            agressor_id: agressor.id,
            tipo_vinculo: tipo_vinculo.trim(),
          });

        if (lErr) {
          console.error("Link error:", lErr);
          return json({ error: "Erro ao vincular agressor" }, 500);
        }

        // Create initial incident if provided
        if (incident && incident.violence_types?.length) {
          await supabase.from("aggressor_incidents").insert({
            aggressor_id: agressor.id,
            reporter_user_id: userId,
            occurred_at_month: incident.occurred_at_month || null,
            violence_types: incident.violence_types,
            severity: incident.severity || 3,
            pattern_tags: incident.pattern_tags || [],
            description_sanitized: incident.description_sanitized?.trim() || null,
            source_type: "usuaria",
            confidence: 0.7,
          });
        }

        await supabase.from("audit_logs").insert([
          { user_id: userId, action_type: "aggressor_created", success: true, details: { agressor_id: agressor.id } },
          { user_id: userId, action_type: "aggressor_linked", success: true, details: { agressor_id: agressor.id, tipo_vinculo } },
        ]);

        return json({ success: true, agressor_id: agressor.id }, 201);
      }

      case "reportIncident": {
        const { agressor_id, violence_types, severity, occurred_at_month, pattern_tags, description_sanitized } = params;
        if (!agressor_id) return json({ error: "agressor_id obrigatório" }, 400);
        if (!violence_types?.length) return json({ error: "Tipo(s) de violência obrigatório(s)" }, 400);

        // Verify user has a link to this aggressor
        const { data: link } = await supabase
          .from("vitimas_agressores")
          .select("id")
          .eq("usuario_id", userId)
          .eq("agressor_id", agressor_id)
          .maybeSingle();
        if (!link) return json({ error: "Você não tem vínculo com este agressor" }, 403);

        const { data: inc, error: incErr } = await supabase
          .from("aggressor_incidents")
          .insert({
            aggressor_id,
            reporter_user_id: userId,
            occurred_at_month: occurred_at_month || null,
            violence_types,
            severity: severity || 3,
            pattern_tags: pattern_tags || [],
            description_sanitized: description_sanitized?.trim() || null,
            source_type: "usuaria",
            confidence: 0.7,
          })
          .select("id")
          .single();

        if (incErr) {
          console.error("Report incident error:", incErr);
          return json({ error: "Erro ao registrar incidente" }, 500);
        }

        // Recalculate risk for this aggressor
        await recalculateAgressorRisk(supabase, agressor_id);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "incident_reported", success: true,
          details: { aggressor_id: agressor_id, incident_id: inc.id },
        });

        return json({ success: true, incident_id: inc.id }, 201);
      }

      case "linkAgressor": {
        const { agressor_id, tipo_vinculo } = params;
        if (!agressor_id || !tipo_vinculo?.trim()) {
          return json({ error: "agressor_id e tipo_vinculo são obrigatórios" }, 400);
        }

        // Check agressor exists
        const { data: ag } = await supabase
          .from("agressores")
          .select("id")
          .eq("id", agressor_id)
          .maybeSingle();
        if (!ag) return json({ error: "Agressor não encontrado" }, 404);

        // Check not already linked
        const { data: existing } = await supabase
          .from("vitimas_agressores")
          .select("id")
          .eq("usuario_id", userId)
          .eq("agressor_id", agressor_id)
          .maybeSingle();
        if (existing) return json({ error: "Agressor já vinculado" }, 409);

        const { error } = await supabase
          .from("vitimas_agressores")
          .insert({ usuario_id: userId, agressor_id, tipo_vinculo: tipo_vinculo.trim() });
        if (error) return json({ error: "Erro ao vincular" }, 500);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "aggressor_linked", success: true,
          details: { agressor_id, tipo_vinculo },
        });

        return json({ success: true }, 201);
      }

      case "getMyAgressores": {
        const { data } = await supabase
          .from("vitimas_agressores")
          .select("id, tipo_vinculo, status_relacao, agressor_id, created_at")
          .eq("usuario_id", userId)
          .order("created_at", { ascending: true });

        // Enrich with agressor details (all editable fields)
        const enriched = await Promise.all((data || []).map(async (v: any) => {
          const { data: ag } = await supabase
            .from("agressores")
            .select("nome, data_nascimento, telefone, forca_seguranca, tem_arma_em_casa, aliases, nome_pai_parcial, nome_mae_parcial, primary_city_uf, neighborhoods, profession, vehicles, sector, risk_level, risk_score, display_name_masked, cor_raca, escolaridade")
            .eq("id", v.agressor_id)
            .single();
          return { ...v, agressor: ag };
        }));

        return json({ success: true, vinculos: enriched });
      }

      case "updateAgressor": {
        const { agressor_id, ...agressorUpdates } = params;
        if (!agressor_id) return json({ error: "agressor_id obrigatório" }, 400);

        // Verify user has a link to this aggressor
        const { data: linkCheck } = await supabase
          .from("vitimas_agressores")
          .select("id")
          .eq("usuario_id", userId)
          .eq("agressor_id", agressor_id)
          .maybeSingle();
        if (!linkCheck) return json({ error: "Você não tem vínculo com este agressor" }, 403);

        const allowedFields = [
          "nome", "data_nascimento", "telefone", "nome_pai_parcial", "nome_mae_parcial",
          "forca_seguranca", "tem_arma_em_casa", "aliases", "approx_age_min", "approx_age_max",
          "primary_city_uf", "neighborhoods", "reference_points", "geo_area_tags",
          "profession", "sector", "company_public", "vehicles",
          "appearance_tags", "phone_clues", "email_clues",
          "cor_raca", "escolaridade",
        ];
        const upd: Record<string, any> = {};
        for (const key of allowedFields) {
          if (agressorUpdates[key] !== undefined) {
            if (key === "telefone" && agressorUpdates[key]) {
              upd[key] = agressorUpdates[key].replace(/\D/g, "");
            } else {
              upd[key] = agressorUpdates[key];
            }
          }
        }

        if (Object.keys(upd).length === 0) {
          return json({ error: "Nenhum campo para atualizar" }, 400);
        }

        const { error: updErr } = await supabase
          .from("agressores")
          .update(upd)
          .eq("id", agressor_id);
        if (updErr) {
          console.error("Update agressor error:", updErr);
          return json({ error: "Erro ao atualizar agressor" }, 500);
        }

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "aggressor_updated", success: true,
          details: { agressor_id, fields: Object.keys(upd) },
        });

        return json({ success: true });
      }

      case "updateVinculo": {
        const { vinculo_id, tipo_vinculo, status_relacao } = params;
        if (!vinculo_id) return json({ error: "vinculo_id obrigatório" }, 400);

        const { data: existing } = await supabase
          .from("vitimas_agressores")
          .select("id")
          .eq("id", vinculo_id)
          .eq("usuario_id", userId)
          .maybeSingle();
        if (!existing) return json({ error: "Vínculo não encontrado" }, 404);

        const upd: Record<string, any> = {};
        if (tipo_vinculo) upd.tipo_vinculo = tipo_vinculo;
        if (status_relacao !== undefined) upd.status_relacao = status_relacao;

        await supabase.from("vitimas_agressores").update(upd).eq("id", vinculo_id);
        return json({ success: true });
      }

      case "deleteVinculo": {
        const { vinculo_id } = params;
        if (!vinculo_id) return json({ error: "vinculo_id obrigatório" }, 400);

        const { data: existing } = await supabase
          .from("vitimas_agressores")
          .select("id")
          .eq("id", vinculo_id)
          .eq("usuario_id", userId)
          .maybeSingle();
        if (!existing) return json({ error: "Vínculo não encontrado" }, 404);

        await supabase.from("vitimas_agressores").delete().eq("id", vinculo_id);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "aggressor_unlinked", success: true,
          details: { vinculo_id },
        });
        return json({ success: true });
      }

      // ========== GRAVAÇÕES ==========
      case "getGravacoes": {
        const { page = 1, per_page = 20, status: filterStatus, nivel_risco: filterNivelRisco } = params;
        const offset = (page - 1) * per_page;

        // If filtering by nivel_risco, first get matching gravacao_ids from analises
        let nivelRiscoIds: string[] | null = null;
        if (filterNivelRisco) {
          const { data: matchingAnalises } = await supabase
            .from("gravacoes_analises")
            .select("gravacao_id")
            .eq("user_id", userId)
            .eq("nivel_risco", filterNivelRisco);
          nivelRiscoIds = (matchingAnalises || []).map((a: any) => a.gravacao_id);
          if (nivelRiscoIds.length === 0) {
            return json({ success: true, gravacoes: [], total: 0, page, per_page });
          }
        }

        let query = supabase
          .from("gravacoes")
          .select("id, created_at, duracao_segundos, tamanho_mb, status, storage_path, transcricao, device_id, timezone", { count: "exact" })
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(offset, offset + per_page - 1);

        if (filterStatus) query = query.eq("status", filterStatus);
        if (nivelRiscoIds) query = query.in("id", nivelRiscoIds);

        const { data, count, error } = await query;
        if (error) return json({ error: "Erro ao buscar gravações" }, 500);

        // Enrich with nivel_risco from analises
        const gravIds = (data || []).map((g: any) => g.id);
        let analiseMap: Record<string, string> = {};
        if (gravIds.length > 0) {
          const { data: analises } = await supabase
            .from("gravacoes_analises")
            .select("gravacao_id, nivel_risco")
            .in("gravacao_id", gravIds);
          if (analises) {
            for (const a of analises) {
              analiseMap[a.gravacao_id] = a.nivel_risco || "";
            }
          }
        }

        const enriched = (data || []).map((g: any) => ({
          ...g,
          nivel_risco: analiseMap[g.id] || null,
        }));

        return json({ success: true, gravacoes: enriched, total: count || 0, page, per_page });
      }

      case "deleteGravacao": {
        const { gravacao_id } = params;
        if (!gravacao_id) return json({ error: "gravacao_id obrigatório" }, 400);

        // Verify ownership and check nivel_risco
        const { data: grav } = await supabase
          .from("gravacoes")
          .select("id, storage_path")
          .eq("id", gravacao_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!grav) return json({ error: "Gravação não encontrada" }, 404);

        // Check analysis - only allow delete for sem_risco or no analysis
        const { data: analise } = await supabase
          .from("gravacoes_analises")
          .select("nivel_risco")
          .eq("gravacao_id", gravacao_id)
          .maybeSingle();
        if (analise && analise.nivel_risco && analise.nivel_risco !== "sem_risco") {
          return json({ error: "Só é possível excluir gravações sem risco" }, 403);
        }

        // Delete analysis
        await supabase.from("gravacoes_analises").delete().eq("gravacao_id", gravacao_id);

        // Delete audio file from R2
        if (grav.storage_path) {
          try {
            const r2 = getR2Client();
            await r2.fetch(r2Url(grav.storage_path), { method: "DELETE" });
          } catch (e) {
            console.error("R2 delete error:", e);
          }
        }

        // Delete recording
        await supabase.from("gravacoes").delete().eq("id", gravacao_id).eq("user_id", userId);

        return json({ success: true });
      }

      case "getGravacaoSignedUrl": {
        const { storage_path } = params;
        if (!storage_path) return json({ error: "storage_path obrigatório" }, 400);

        // Verify ownership
        const { data: rec } = await supabase
          .from("gravacoes")
          .select("id")
          .eq("user_id", userId)
          .eq("storage_path", storage_path)
          .maybeSingle();

        if (!rec) {
          // Also check segments
          const { data: seg } = await supabase
            .from("gravacoes_segmentos")
            .select("id")
            .eq("user_id", userId)
            .eq("storage_path", storage_path)
            .maybeSingle();
          if (!seg) return json({ error: "Gravação não encontrada" }, 404);
        }

        // Always use presigned URLs to avoid CORS issues with R2 public URLs

        // Generate presigned URL from R2
        try {
          const r2 = getR2Client();
          const url = r2Url(storage_path);
          const signedUrl = await r2.sign(url, { method: "GET", aws: { signQuery: true } });
          return json({ success: true, url: signedUrl.url });
        } catch (e) {
          console.error("R2 signed URL error:", e);
          return json({ error: "Erro ao gerar URL" }, 500);
        }
      }

      case "getSegmentos": {
        const { session_id } = params;
        if (!session_id) return json({ error: "session_id obrigatório" }, 400);

        const { data } = await supabase
          .from("gravacoes_segmentos")
          .select("id, created_at, segmento_idx, duracao_segundos, tamanho_mb, storage_path")
          .eq("user_id", userId)
          .eq("monitor_session_id", session_id)
          .order("segmento_idx", { ascending: true });

        return json({ success: true, segmentos: data || [] });
      }

      // ========== UPLOAD DE ÁUDIO ==========
      case "uploadGravacao": {
        const { file_base64, file_name, content_type, duracao_segundos } = params;
        if (!file_base64) return json({ error: "file_base64 obrigatório" }, 400);

        const binaryStr = atob(file_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const ext = (file_name || "audio.webm").split(".").pop() || "webm";
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const storagePath = `${userId}/${today}/${crypto.randomUUID()}.${ext}`;
        const mime = content_type || "audio/webm";
        const sizeMb = +(bytes.length / (1024 * 1024)).toFixed(3);

        try {
          const r2 = getR2Client();
          const url = r2Url(storagePath);
          console.log("R2 upload URL:", url, "Bucket:", Deno.env.get("R2_BUCKET_NAME"), "Account:", Deno.env.get("R2_ACCOUNT_ID"));
          const uploadResp = await r2.fetch(url, {
            method: "PUT",
            headers: { "Content-Type": mime },
            body: bytes,
          });
          if (!uploadResp.ok) {
            const errText = await uploadResp.text();
            console.error("R2 upload error:", uploadResp.status, errText);
            return json({ error: "Erro ao enviar arquivo de áudio" }, 500);
          }
        } catch (e) {
          console.error("R2 upload error:", e);
          return json({ error: "Erro ao enviar arquivo de áudio" }, 500);
        }

        const { data: rec, error: dbErr } = await supabase
          .from("gravacoes")
          .insert({
            user_id: userId,
            storage_path: storagePath,
            status: "pendente",
            tamanho_mb: sizeMb,
            duracao_segundos: duracao_segundos || null,
            device_id: "web",
          })
          .select("id")
          .single();

        if (dbErr) {
          console.error("DB insert error:", dbErr);
          return json({ error: "Erro ao registrar gravação" }, 500);
        }

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "gravacao_uploaded", success: true,
          details: { gravacao_id: rec.id, size_mb: sizeMb },
        });

        // Trigger async processing (transcription + AI analysis)
        const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-recording`;
        fetch(processUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ gravacao_id: rec.id }),
        }).catch((e) => console.error("Failed to trigger processing:", e));

        return json({ success: true, gravacao_id: rec.id }, 201);
      }

      // ========== ANÁLISE ==========
      case "getAnalise": {
        const { gravacao_id } = params;
        if (!gravacao_id) return json({ error: "gravacao_id obrigatório" }, 400);

        // Verify ownership
        const { data: grav } = await supabase
          .from("gravacoes")
          .select("id, status, transcricao")
          .eq("id", gravacao_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (!grav) return json({ error: "Gravação não encontrada" }, 404);

        const { data: analise } = await supabase
          .from("gravacoes_analises")
          .select("id, resumo, sentimento, nivel_risco, categorias, palavras_chave, analise_completa, modelo_usado, created_at")
          .eq("gravacao_id", gravacao_id)
          .eq("user_id", userId)
          .maybeSingle();

        return json({
          success: true,
          status: grav.status,
          transcricao: grav.transcricao,
          analise: analise || null,
        });
      }

      // ========== RISK ENGINE ==========
      case "getRiskAssessment": {
        const windowDays = params.window_days;
        if (![7, 15, 30].includes(windowDays)) {
          return json({ error: "window_days deve ser 7, 15 ou 30" }, 400);
        }

        const today = new Date().toISOString().slice(0, 10);

        // Check cache (< 1h old)
        const { data: cached } = await supabase
          .from("risk_assessments")
          .select("*")
          .eq("usuario_id", userId)
          .eq("window_days", windowDays)
          .eq("period_end", today)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached) {
          const computedAt = new Date(cached.computed_at).getTime();
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          if (computedAt > oneHourAgo) {
            return json({ success: true, assessment: cached, from_cache: true });
          }
        }

        // Build payload and call Gemini
        const payload = await buildRiskHistoryPayload(supabase, userId, windowDays);
        const result = await computeRiskWithGemini(payload);

        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - windowDays);

        // Upsert
        if (cached) {
          await supabase
            .from("risk_assessments")
            .update({
              risk_score: result.risk_score,
              risk_level: result.risk_level,
              trend: result.trend,
              trend_percentage: result.trend_percentage || null,
              fatores: result.fatores_principais,
              resumo_tecnico: result.resumo_tecnico,
              computed_at: new Date().toISOString(),
              period_start: periodStart.toISOString().slice(0, 10),
            })
            .eq("id", cached.id);
        } else {
          await supabase.from("risk_assessments").insert({
            usuario_id: userId,
            window_days: windowDays,
            period_start: periodStart.toISOString().slice(0, 10),
            period_end: today,
            risk_score: result.risk_score,
            risk_level: result.risk_level,
            trend: result.trend,
            trend_percentage: result.trend_percentage || null,
            fatores: result.fatores_principais,
            resumo_tecnico: result.resumo_tecnico,
          });
        }

        // Fetch the saved record
        const { data: saved } = await supabase
          .from("risk_assessments")
          .select("*")
          .eq("usuario_id", userId)
          .eq("window_days", windowDays)
          .eq("period_end", today)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return json({ success: true, assessment: saved, from_cache: false });
      }

      case "getRiskHistory": {
        const windowDays = params.window_days;
        if (![7, 15, 30].includes(windowDays)) {
          return json({ error: "window_days deve ser 7, 15 ou 30" }, 400);
        }
        const limit = params.limit || 30;

        const { data } = await supabase
          .from("risk_assessments")
          .select("id, period_end, risk_score, risk_level, trend, trend_percentage, computed_at")
          .eq("usuario_id", userId)
          .eq("window_days", windowDays)
          .order("period_end", { ascending: false })
          .limit(limit);

        return json({ success: true, history: (data || []).reverse() });
      }

      // ========== AGENDAMENTOS DE MONITORAMENTO ==========
      case "getSchedules": {
        const { data } = await supabase
          .from("agendamentos_monitoramento")
          .select("periodos_semana, updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        return json({ success: true, periodos_semana: data?.periodos_semana || null, updated_at: data?.updated_at || null });
      }

      case "updateSchedules": {
        const { periodos_semana } = params;
        if (!periodos_semana || typeof periodos_semana !== "object") {
          return json({ error: "periodos_semana obrigatório" }, 400);
        }

        // Basic server-side validation
        const dias = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
        let totalPeriodos = 0;
        let totalMinutos = 0;
        for (const dia of dias) {
          const arr = periodos_semana[dia];
          if (!Array.isArray(arr)) continue;
          if (arr.length > 6) return json({ error: `Máximo de 6 períodos por dia (${dia})` }, 400);
          for (const p of arr) {
            if (!p.inicio || !p.fim) return json({ error: "Horários obrigatórios" }, 400);
            const [hi, mi] = p.inicio.split(":").map(Number);
            const [hf, mf] = p.fim.split(":").map(Number);
            const startMin = hi * 60 + mi;
            const endMin = hf * 60 + mf;
            if (endMin <= startMin) return json({ error: "Horário final deve ser maior que o inicial" }, 400);
            totalMinutos += endMin - startMin;
            totalPeriodos++;
          }
        }

        // Upsert
        const { data: existing } = await supabase
          .from("agendamentos_monitoramento")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        let dbError;
        if (existing) {
          const { error: e } = await supabase
            .from("agendamentos_monitoramento")
            .update({ periodos_semana, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
          dbError = e;
        } else {
          const { error: e } = await supabase
            .from("agendamentos_monitoramento")
            .insert({ user_id: userId, periodos_semana });
          dbError = e;
        }

        if (dbError) {
          console.error("Schedule save error:", dbError);
          await supabase.from("audit_logs").insert({
            user_id: userId, action_type: "update_schedules", success: false,
            details: { error: dbError.message },
          });
          return json({ error: "Erro ao salvar configurações" }, 500);
        }

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "update_schedules", success: true,
          details: { total_periodos: totalPeriodos, total_horas_semana: +(totalMinutos / 60).toFixed(1) },
        });

        // Try to sync with mobile API (fire-and-forget)
        try {
          const mobileUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mobile-api`;
          const syncRes = await fetch(mobileUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ action: "update_schedules", session_token: session_token, periodos_semana }),
          });
          const syncOk = syncRes.ok;
          if (!syncOk) {
            console.warn("Mobile API sync failed:", syncRes.status);
          }
        } catch (e) {
          console.warn("Mobile API sync error:", e);
        }

        return json({ success: true });
      }

      // ========== ACIONAMENTOS AUTOMÁTICOS ==========
      case "getAlertTriggers": {
        const { data } = await supabase
          .from("usuarios")
          .select("configuracao_alertas")
          .eq("id", userId)
          .single();

        const defaults = {
          acionamentos: {
            whatsapp_guardioes: { grave: true, critico: true },
            autoridades_190_180: { critico: false },
            senha_coacao: { notificar_guardioes: true },
          },
        };
        let config = data?.configuracao_alertas && Object.keys(data.configuracao_alertas).length > 0
          ? data.configuracao_alertas
          : defaults;
        // Ensure senha_coacao exists for users with old config
        if (config.acionamentos && !config.acionamentos.senha_coacao) {
          config = { ...config, acionamentos: { ...config.acionamentos, senha_coacao: { notificar_guardioes: true } } };
        }

        return json({ success: true, configuracao: config });
      }

      case "updateAlertTriggers": {
        const { acionamentos } = params;
        if (!acionamentos || typeof acionamentos !== "object") {
          return json({ error: "acionamentos obrigatório" }, 400);
        }

        // Validate structure
        const wg = acionamentos.whatsapp_guardioes;
        const au = acionamentos.autoridades_190_180;
        const sc = acionamentos.senha_coacao;
        if (!wg || typeof wg.grave !== "boolean" || typeof wg.critico !== "boolean") {
          return json({ error: "whatsapp_guardioes inválido" }, 400);
        }
        if (!au || typeof au.critico !== "boolean") {
          return json({ error: "autoridades_190_180 inválido" }, 400);
        }
        if (!sc || typeof sc.notificar_guardioes !== "boolean") {
          return json({ error: "senha_coacao inválido" }, 400);
        }

        const configValue = { acionamentos: { whatsapp_guardioes: { grave: wg.grave, critico: wg.critico }, autoridades_190_180: { critico: au.critico }, senha_coacao: { notificar_guardioes: sc.notificar_guardioes } } };

        const { error } = await supabase
          .from("usuarios")
          .update({ configuracao_alertas: configValue })
          .eq("id", userId);
        if (error) {
          await supabase.from("audit_logs").insert({
            user_id: userId, action_type: "update_alert_triggers", success: false,
            details: { error: error.message },
          });
          return json({ error: "Erro ao salvar configurações" }, 500);
        }

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "update_alert_triggers", success: true,
          details: configValue,
        });
        return json({ success: true });
      }

      // ========== COMPARTILHAMENTO GPS ==========
      case "getShareLink": {
        // Check if there's already an active share link for the user
        const { data: existingShare } = await supabase
          .from("compartilhamento_gps")
          .select("id, codigo, tipo, expira_em, criado_em")
          .eq("user_id", userId)
          .eq("ativo", true)
          .gt("expira_em", new Date().toISOString())
          .maybeSingle();

        if (existingShare) {
          return json({ success: true, compartilhamento: existingShare });
        }
        return json({ success: true, compartilhamento: null });
      }

      case "createShareLink": {
        const tipo = (params.tipo as string) || "panico";
        const alertaId = params.alerta_id as string | undefined;

        // Get user's GPS duration setting
        const { data: usr } = await supabase
          .from("usuarios")
          .select("gps_duracao_minutos")
          .eq("id", userId)
          .single();

        const duracaoMin = usr?.gps_duracao_minutos || 30;
        const expiraEm = new Date(Date.now() + duracaoMin * 60 * 1000).toISOString();

        // Deactivate previous links
        await supabase
          .from("compartilhamento_gps")
          .update({ ativo: false })
          .eq("user_id", userId)
          .eq("ativo", true);

        // Generate 5-char alphanumeric code
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let codigo = "";
        const arr = new Uint8Array(5);
        crypto.getRandomValues(arr);
        for (const b of arr) codigo += chars[b % chars.length];

        const insertData: Record<string, unknown> = {
          user_id: userId,
          codigo,
          tipo,
          expira_em: expiraEm,
        };
        if (alertaId) insertData.alerta_id = alertaId;

        const { data: share, error: sErr } = await supabase
          .from("compartilhamento_gps")
          .insert(insertData)
          .select("id, codigo, tipo, expira_em, criado_em")
          .single();

        if (sErr) {
          console.error("createShareLink error:", sErr);
          return json({ error: "Erro ao criar link de compartilhamento" }, 500);
        }

        return json({ success: true, compartilhamento: share }, 201);
      }

      case "deactivateShareLink": {
        await supabase
          .from("compartilhamento_gps")
          .update({ ativo: false })
          .eq("user_id", userId)
          .eq("ativo", true);
        return json({ success: true });
      }

      // ========== RELATÓRIO DE SAÚDE DA RELAÇÃO ==========
      case "getRelatorioSaude": {
        const windowDays = params.window_days || 90;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - windowDays);
        const startStr = startDate.toISOString();

        // 1. Fetch analyses
        const { data: analises } = await supabase
          .from("gravacoes_analises")
          .select("sentimento, categorias, palavras_chave, nivel_risco, analise_completa, created_at")
          .eq("user_id", userId)
          .gte("created_at", startStr)
          .order("created_at", { ascending: true });

        // 2. Fetch risk history
        const { data: riskHistory } = await supabase
          .from("risk_assessments")
          .select("risk_score, risk_level, period_end, trend")
          .eq("usuario_id", userId)
          .order("period_end", { ascending: false })
          .limit(30);

        // 3. Fetch aggressor info
        const { data: vinculos } = await supabase
          .from("vitimas_agressores")
          .select("tipo_vinculo, status_relacao, agressor_id")
          .eq("usuario_id", userId);

        let agressorFlags: Record<string, any> = {};
        if (vinculos && vinculos.length > 0) {
          const agIds = vinculos.map((v: any) => v.agressor_id);
          const { data: agressores } = await supabase
            .from("agressores")
            .select("id, forca_seguranca, tem_arma_em_casa, flags, risk_level")
            .in("id", agIds);
          if (agressores && agressores.length > 0) {
            const ag = agressores[0];
            agressorFlags = {
              forca_seguranca: ag.forca_seguranca,
              tem_arma: ag.tem_arma_em_casa,
              flags: ag.flags,
              risk_level: ag.risk_level,
            };
          }
        }

        // 4. Fetch panic alerts count
        const { data: alertas } = await supabase
          .from("alertas_panico")
          .select("id, tipo_acionamento, status")
          .eq("user_id", userId)
          .gte("criado_em", startStr);

        // 5. Aggregate data
        const sentimentos: Record<string, number> = { positivo: 0, negativo: 0, neutro: 0, misto: 0 };
        const tiposViolencia: Record<string, number> = {};
        const padroesCount: Record<string, number> = {};
        const palavrasCount: Record<string, number> = {};
        const niveisRisco: Record<string, number> = {};

        for (const a of (analises || [])) {
          // Sentimentos
          const sent = (a.sentimento || "neutro").toLowerCase();
          if (sentimentos[sent] !== undefined) sentimentos[sent]++;
          else sentimentos["neutro"]++;

          // Categorias (tipos de violência)
          for (const cat of (a.categorias || [])) {
            tiposViolencia[cat] = (tiposViolencia[cat] || 0) + 1;
          }

          // Palavras-chave
          for (const pw of (a.palavras_chave || [])) {
            palavrasCount[pw] = (palavrasCount[pw] || 0) + 1;
          }

          // Nivel de risco
          if (a.nivel_risco) {
            niveisRisco[a.nivel_risco] = (niveisRisco[a.nivel_risco] || 0) + 1;
          }

          // Padrões da análise completa
          const ac = a.analise_completa as any;
          if (ac?.padroes_detectados) {
            for (const p of ac.padroes_detectados) {
              const nome = typeof p === "string" ? p : p?.padrao || p?.nome || "";
              if (nome) padroesCount[nome] = (padroesCount[nome] || 0) + 1;
            }
          }
        }

        const totalGravacoes = (analises || []).length;
        const totalAlertas = (alertas || []).length;

        // Sort and pick top items
        const topViolencia = Object.entries(tiposViolencia)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([tipo, contagem]) => ({ tipo, contagem }));

        const topPadroes = Object.entries(padroesCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([padrao, contagem]) => ({ padrao, contagem }));

        const topPalavras = Object.entries(palavrasCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([palavra, contagem]) => ({ palavra, contagem }));

        // 6. Call AI for narrative
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        let aiResult: any = null;

        if (LOVABLE_API_KEY && totalGravacoes > 0) {
          const aiPrompt = `Você é uma especialista em relações conjugais saudáveis, com experiência em psicologia de casais e assistência social. Com base nos dados agregados abaixo, gere um relatório humanizado sobre a saúde da relação desta mulher.

PRINCÍPIO FUNDAMENTAL:
O foco deste sistema é a PROTEÇÃO DA MULHER. Ao analisar e orientar, considere que:
- O sistema tem uma leve tendência a favor da vítima (a mulher). Na dúvida, proteja-a.
- Nem toda discordância é abuso, mas não minimize comportamentos que possam ser nocivos a ela.
- Somente aponte comportamentos inadequados da mulher quando forem MUITO CLAROS e evidentes (agressão física, ameaças explícitas).
- Desabafos, frustrações e reações emocionais da mulher são respostas esperadas e NÃO devem ser tratados como problemas dela.
- Promova diálogo e maturidade emocional, mas sempre priorizando a segurança e o bem-estar da mulher.
- Em situações de risco real (violência, ameaças, controle abusivo), oriente medidas de proteção sem hesitação.

DADOS AGREGADOS (últimos ${windowDays} dias):
- Total de gravações analisadas: ${totalGravacoes}
- Alertas de pânico: ${totalAlertas}
- Distribuição de sentimentos: ${JSON.stringify(sentimentos)}
- Tipos de violência detectados: ${JSON.stringify(topViolencia)}
- Padrões recorrentes: ${JSON.stringify(topPadroes)}
- Palavras-chave frequentes: ${JSON.stringify(topPalavras)}
- Níveis de risco das gravações: ${JSON.stringify(niveisRisco)}
- Informações do agressor: ${JSON.stringify(agressorFlags)}
- Último risk score: ${riskHistory?.[0]?.risk_score || "N/A"}
- Último risk level: ${riskHistory?.[0]?.risk_level || "N/A"}

INSTRUÇÕES:
1. "panorama_narrativo": 2-3 parágrafos acolhedores e equilibrados explicando a situação atual. Use linguagem empática, sem jargão técnico ou jurídico. Comece com "Nos últimos ${windowDays} dias...". Seja honesta sobre o que os dados mostram sem minimizar riscos reais, mas também sem dramatizar conflitos normais.
2. "explicacao_emocional": 2-3 frases explicando o que a distribuição de sentimentos significa para ela no dia a dia, considerando o contexto de uma relação a dois onde ambos têm responsabilidades emocionais.
3. "orientacoes": 3-5 orientações práticas e ESPECÍFICAS para combater cada padrão recorrente identificado. Cada orientação deve mencionar qual padrão ela combate e dar uma ação concreta. Priorize: comunicação assertiva, busca de terapia de casal, estabelecimento de limites saudáveis, autocrítica construtiva. Se houver risco alto/crítico com violência real, priorize segurança física. Tom equilibrado: empoderador mas também promotor de responsabilidade mútua.
4. "canais_apoio": Liste canais relevantes como "Central de Atendimento à Mulher: ligue 180", "Polícia Militar: ligue 190", "Delegacia da Mulher mais próxima".

RETORNE APENAS JSON válido:
{
  "panorama_narrativo": "texto...",
  "explicacao_emocional": "texto...",
  "orientacoes": ["orientação 1", "orientação 2", ...],
  "canais_apoio": ["canal 1", "canal 2", ...]
}`;

          try {
            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "user", content: aiPrompt },
                ],
                temperature: 0.4,
                max_tokens: 4000,
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              let content = aiData.choices?.[0]?.message?.content || "";
              const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (jsonMatch) content = jsonMatch[1];
              try {
                aiResult = JSON.parse(content.trim());
              } catch {
                console.error("Failed to parse AI report response:", content.slice(0, 200));
              }
            } else {
              console.error("AI report error:", aiResponse.status);
            }
          } catch (e) {
            console.error("AI report fetch error:", e);
          }
        }

        return json({
          success: true,
          relatorio: {
            periodo: {
              inicio: startDate.toISOString().slice(0, 10),
              fim: endDate.toISOString().slice(0, 10),
              dias: windowDays,
              total_gravacoes: totalGravacoes,
              total_alertas: totalAlertas,
            },
            sentimentos,
            tipos_violencia: topViolencia,
            padroes_recorrentes: topPadroes,
            palavras_frequentes: topPalavras,
            niveis_risco: niveisRisco,
            agressor: agressorFlags,
            risco_atual: riskHistory?.[0] || null,
            panorama_narrativo: aiResult?.panorama_narrativo || null,
            explicacao_emocional: aiResult?.explicacao_emocional || null,
            orientacoes: aiResult?.orientacoes || [],
            canais_apoio: aiResult?.canais_apoio || [
              "Central de Atendimento à Mulher: ligue 180",
              "Polícia Militar: ligue 190",
              "Delegacia da Mulher mais próxima",
            ],
          },
        });
      }

      // ========== CANCELAR PÂNICO ==========
      case "cancelPanico": {
        const now = new Date();
        const { data: alerta } = await supabase
          .from("alertas_panico")
          .select("id, criado_em")
          .eq("user_id", userId)
          .eq("status", "ativo")
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!alerta) return json({ error: "Nenhum alerta ativo encontrado" }, 404);

        const criadoEm = new Date(alerta.criado_em);
        const tempoAte = Math.round((now.getTime() - criadoEm.getTime()) / 1000);

        await supabase.from("alertas_panico").update({
          status: "cancelado",
          cancelado_em: now.toISOString(),
          motivo_cancelamento: params.motivo || "Cancelado pelo painel web",
          tipo_cancelamento: "manual_web",
          cancelado_dentro_janela: tempoAte <= 60,
          tempo_ate_cancelamento_segundos: tempoAte,
          window_selada: true,
        }).eq("id", alerta.id);

        // Auto-seal monitoring session
        const { data: activeSession } = await supabase
          .from("monitoramento_sessoes")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "ativa")
          .maybeSingle();
        if (activeSession) {
          await supabase.from("monitoramento_sessoes").update({
            status: "aguardando_finalizacao",
            closed_at: now.toISOString(),
            sealed_reason: "panico_cancelado_web",
          }).eq("id", activeSession.id);
        }

        // Reset device recording/monitoring flags
        await supabase
          .from("device_status")
          .update({ is_recording: false, is_monitoring: false })
          .eq("user_id", userId);

        // Deactivate GPS sharing linked to this alert
        await supabase
          .from("compartilhamento_gps")
          .update({ ativo: false })
          .eq("user_id", userId)
          .eq("alerta_id", alerta.id);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "panic_cancelled_web", success: true,
          details: { alerta_id: alerta.id, tempo_segundos: tempoAte },
        });

        return json({ success: true, alerta_id: alerta.id });
      }

      // ========== ANALYSIS PIPELINE (proxy to analysis-worker) ==========
      case "getMacroLatest":
      case "runMacro":
      case "getHeuristicsStatus":
      case "runMicroAnalysis": {
        const workerAction = action === "runMicroAnalysis" ? "runMicro" : action;
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const workerRes = await fetch(`${supabaseUrl}/functions/v1/analysis-worker`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: workerAction, session_token, ...params }),
        });
        const workerData = await workerRes.json();
        return json(workerData, workerRes.status);
      }

      default:
        return json({ error: `Action desconhecida: ${action}` }, 400);
    }
  } catch (err) {
    console.error("web-api error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});

// ========== RISK ENGINE HELPERS ==========

async function buildRiskHistoryPayload(supabase: any, userId: string, windowDays: number) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - windowDays);
  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();
  const startDateOnly = startDate.toISOString().slice(0, 10);
  const endDateOnly = endDate.toISOString().slice(0, 10);

  // 1. Alertas de pânico
  const { data: alertas } = await supabase
    .from("alertas_panico")
    .select("criado_em, status, tipo_cancelamento")
    .eq("user_id", userId)
    .gte("criado_em", startStr)
    .lte("criado_em", endStr);

  // 2. Gravações
  const { data: gravacoes } = await supabase
    .from("gravacoes")
    .select("created_at, status")
    .eq("user_id", userId)
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  // 3. Segmentos
  const { data: segmentos } = await supabase
    .from("gravacoes_segmentos")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  // 4. Análises (categorias e nível de risco)
  const { data: analises } = await supabase
    .from("gravacoes_analises")
    .select("created_at, categorias, nivel_risco")
    .eq("user_id", userId)
    .gte("created_at", startStr)
    .lte("created_at", endStr);

  // 5. Audit logs (coerção)
  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("created_at, action_type")
    .eq("user_id", userId)
    .gte("created_at", startStr)
    .lte("created_at", endStr)
    .in("action_type", ["login_coercion", "coercion_detected", "panic_coercion"]);

  // 6. Perfil do agressor
  const { data: vinculos } = await supabase
    .from("vitimas_agressores")
    .select("agressor_id")
    .eq("usuario_id", userId);

  let aggressorFlags = {
    weapon_flag: false,
    security_force_flag: false,
  };

  if (vinculos && vinculos.length > 0) {
    const agIds = vinculos.map((v: any) => v.agressor_id);
    const { data: agressores } = await supabase
      .from("agressores")
      .select("tem_arma_em_casa, forca_seguranca")
      .in("id", agIds);

    if (agressores) {
      for (const ag of agressores) {
        if (ag.tem_arma_em_casa) aggressorFlags.weapon_flag = true;
        if (ag.forca_seguranca) aggressorFlags.security_force_flag = true;
      }
    }
  }

  // Build daily summary
  const dailyMap: Record<string, any> = {};
  const initDay = (date: string) => {
    if (!dailyMap[date]) {
      dailyMap[date] = {
        date,
        counts: {
          panic_activated: 0,
          panic_canceled_manual: 0,
          panic_canceled_timeout: 0,
          panic_canceled_coercion: 0,
          audio_records: 0,
          audio_segments: 0,
          threat_events: 0,
          psychological_events: 0,
          physical_events: 0,
          moral_events: 0,
          patrimonial_events: 0,
          coercion_events: 0,
        },
      };
    }
  };

  for (const a of alertas || []) {
    const day = a.criado_em.slice(0, 10);
    initDay(day);
    dailyMap[day].counts.panic_activated++;
    if (a.tipo_cancelamento === "manual") dailyMap[day].counts.panic_canceled_manual++;
    if (a.tipo_cancelamento === "timeout") dailyMap[day].counts.panic_canceled_timeout++;
    if (a.tipo_cancelamento === "coercao") dailyMap[day].counts.panic_canceled_coercion++;
  }

  for (const g of gravacoes || []) {
    const day = g.created_at.slice(0, 10);
    initDay(day);
    dailyMap[day].counts.audio_records++;
  }

  for (const s of segmentos || []) {
    const day = s.created_at.slice(0, 10);
    initDay(day);
    dailyMap[day].counts.audio_segments++;
  }

  const categoryMap: Record<string, string> = {
    ameaca: "threat_events",
    violencia_psicologica: "psychological_events",
    violencia_fisica: "physical_events",
    violencia_moral: "moral_events",
    violencia_patrimonial: "patrimonial_events",
  };

  for (const an of analises || []) {
    const day = an.created_at.slice(0, 10);
    initDay(day);
    if (an.categorias && Array.isArray(an.categorias)) {
      for (const cat of an.categorias) {
        const key = categoryMap[cat];
        if (key) dailyMap[day].counts[key]++;
      }
    }
  }

  for (const log of auditLogs || []) {
    const day = log.created_at.slice(0, 10);
    initDay(day);
    dailyMap[day].counts.coercion_events++;
  }

  const dailySummary = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Totals
  const totals = {
    panic_activated: 0, panic_canceled_manual: 0, panic_canceled_timeout: 0, panic_canceled_coercion: 0,
    audio_records: 0, audio_segments: 0,
    threat_events: 0, psychological_events: 0, physical_events: 0, moral_events: 0, patrimonial_events: 0,
    coercion_events: 0,
  };
  for (const day of dailySummary as any[]) {
    for (const [k, v] of Object.entries(day.counts)) {
      (totals as any)[k] += v as number;
    }
  }

  return {
    usuario_id: userId,
    window_days: windowDays,
    period_start: startDateOnly,
    period_end: endDateOnly,
    daily_summary: dailySummary,
    totals,
    aggressor_profile_flags: aggressorFlags,
  };
}

async function computeRiskWithGemini(payload: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `Você é um Analista de Risco Dinâmico especializado em violência doméstica.

Você receberá um JSON com histórico agregado (7/15/30 dias) de eventos e sinais.
Seu trabalho é calcular um score de risco (0 a 100), classificar nível, identificar tendência e explicar fatores principais.
Você deve analisar o contexto ao longo do tempo (evolução), não apenas um dia isolado.

ENTRADA
Você receberá um JSON com:
- window_days, period_start, period_end
- daily_summary[] com contagens por dia e flags
- totals agregados
- aggressor_profile_flags (arma, força de segurança, ameaça, medida protetiva etc.)
- context_samples (opcional, já sanitizado)

OBJETIVO
Retornar JSON no formato exato usando a função assess_risk.

REGRAS DE ANÁLISE (CONTEXTUAL E TEMPORAL)
1) Avalie o padrão ao longo dos dias:
   - frequência (quantas ocorrências)
   - intensidade (pânico, coerção, ameaça)
   - escalada (crescimento nos últimos 3-5 dias)
   - persistência (eventos repetidos)
2) Diferencie um pico isolado vs tendência contínua.
3) Considere flags do agressor como multiplicadores de risco:
   - arma em casa aumenta risco
   - força de segurança aumenta risco
   - medida protetiva e descumprimento aumentam risco fortemente
4) Coerção (cancelamento sob coerção) é indicador crítico.
5) Se não houver eventos por longo período, risco pode reduzir gradualmente, mas nunca zerar se houver flags graves (arma/ameaça/descumprimento).

METODOLOGIA (HEURÍSTICA + CALIBRAÇÃO)
Use um score base por evento e ajuste por tendência:
- panic_activated: +20
- panic_canceled_coercion: +25
- threat_events: +15 cada (cap por dia: +30)
- physical_events: +25 cada
- psychological_events: +8 cada (cap por dia: +20)
- patrimonial_events: +10 cada
- moral_events: +6 cada
- protective_order_breached_flag: +30 (se true em qualquer dia)
- weapon_flag: +15 (se true)
- security_force_flag: +10 (se true)

TENDÊNCIA
- Calcular média dos primeiros 30% do período vs últimos 30% do período.
- trend_percentage = ((media_final - media_inicial) / max(media_inicial,1)) * 100
- Classificação:
  - Subindo se trend_percentage >= +10%
  - Reduzindo se <= -10%
  - Estável caso contrário

LEVEL
- 0-25: Baixo
- 26-50: Moderado
- 51-75: Alto
- 76-100: Crítico

Ajuste para "Crítico" automaticamente se:
- houver coerção + ameaça + arma
- ou descumprimento de medida protetiva
- ou ameaça de morte (se vier sinalizado)

FATORES PRINCIPAIS
- Liste de 3 a 6 fatores com linguagem curta e técnica, por exemplo:
  "Coerção detectada em cancelamento de pânico"
  "Aumento de ameaças nos últimos 5 dias"
  "Flag: presença de arma em casa"

CONDUTA
- Não inventar fatos que não estejam no JSON.
- Não inserir dados pessoais.
- Resposta sempre em JSON válido.`;

  const userPrompt = `Dados dos últimos ${payload.window_days} dias (${payload.period_start} a ${payload.period_end}):

Totais: ${JSON.stringify(payload.totals)}
Perfil do agressor: ${JSON.stringify(payload.aggressor_profile_flags)}
Resumo diário: ${JSON.stringify(payload.daily_summary)}

Analise e retorne a avaliação de risco usando a função assess_risk.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "assess_risk",
            description: "Retorna a avaliação estruturada de risco de violência doméstica",
            parameters: {
              type: "object",
              properties: {
                risk_score: { type: "integer", description: "Score de risco 0-100" },
                risk_level: { type: "string", enum: ["Baixo", "Moderado", "Alto", "Crítico"] },
                trend: { type: "string", enum: ["Subindo", "Estável", "Reduzindo"] },
                trend_percentage: { type: "number", description: "Variação percentual" },
                fatores_principais: { type: "array", items: { type: "string" }, description: "Lista de fatores de risco" },
                resumo_tecnico: { type: "string", description: "Resumo curto da avaliação" },
              },
              required: ["risk_score", "risk_level", "trend", "trend_percentage", "fatores_principais", "resumo_tecnico"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "assess_risk" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    // Return a safe default
    return {
      risk_score: 0,
      risk_level: "Baixo",
      trend: "Estável",
      trend_percentage: 0,
      fatores_principais: ["Erro ao processar avaliação de risco"],
      resumo_tecnico: "Não foi possível calcular o risco neste momento.",
    };
}

// ========== ACIONAMENTOS AUTOMÁTICOS HELPERS ==========

interface UserAlertSettings {
  acionamentos?: {
    whatsapp_guardioes?: { grave?: boolean; critico?: boolean };
    autoridades_190_180?: { critico?: boolean };
  };
}

/**
 * Determines whether a given channel should be triggered for a risk level.
 * Rules:
 * - "grave": WhatsApp only if whatsapp_guardioes.grave=true. 190/180 NEVER.
 * - "critico": WhatsApp if whatsapp_guardioes.critico=true. 190/180 if autoridades_190_180.critico=true.
 */
function shouldTrigger(channel: "whatsapp_guardioes" | "autoridades_190_180", level: "grave" | "critico", userSettings: UserAlertSettings): boolean {
  const ac = userSettings?.acionamentos;
  if (!ac) return false;

  if (channel === "whatsapp_guardioes") {
    const wg = ac.whatsapp_guardioes;
    if (level === "grave") return wg?.grave === true;
    if (level === "critico") return wg?.critico === true;
    return false;
  }

  if (channel === "autoridades_190_180") {
    // 190/180 NUNCA dispara para "grave", mesmo se configurado
    if (level === "grave") return false;
    if (level === "critico") return ac.autoridades_190_180?.critico === true;
    return false;
  }

  return false;
}

/**
 * Placeholder: trigger WhatsApp notification to guardians.
 * Integration point for actual WhatsApp API dispatch.
 */
async function triggerWhatsAppGuardians(
  _supabase: any,
  _usuario_id: string,
  _alerta_id: string,
  _level: string,
  _payload: Record<string, any>
): Promise<void> {
  // TODO: integrate with WhatsApp Business API / template messaging
  console.log(`[PLACEHOLDER] triggerWhatsAppGuardians called for user=${_usuario_id}, alerta=${_alerta_id}, level=${_level}`);
}

/**
 * Placeholder: trigger authorities (190/180).
 * Integration point for actual emergency channel dispatch.
 */
async function triggerAuthorities190180(
  _supabase: any,
  _usuario_id: string,
  _alerta_id: string,
  _payload: Record<string, any>
): Promise<void> {
  // TODO: integrate with 190/180 dispatch system
  console.log(`[PLACEHOLDER] triggerAuthorities190180 called for user=${_usuario_id}, alerta=${_alerta_id}`);
}

  const data = await response.json();
  try {
    const toolCall = data.choices[0].message.tool_calls[0];
    const args = JSON.parse(toolCall.function.arguments);
    return args;
  } catch (e) {
    console.error("Failed to parse Gemini response:", e, JSON.stringify(data));
    return {
      risk_score: 0,
      risk_level: "Baixo",
      trend: "Estável",
      trend_percentage: 0,
      fatores_principais: ["Erro ao interpretar resposta da IA"],
      resumo_tecnico: "Não foi possível calcular o risco neste momento.",
    };
  }
}
