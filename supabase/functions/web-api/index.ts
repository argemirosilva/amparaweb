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

      // Fetch from R2 and stream back with CORS headers
      try {
        const r2 = getR2Client();
        const r2FullUrl = r2Url(storagePath);
        const signed = await r2.sign(r2FullUrl, { method: "GET" });
        const r2Resp = await fetch(signed.url, { headers: signed.headers });
        if (!r2Resp.ok) {
          return json({ error: "Erro ao buscar áudio do storage" }, 502);
        }
        
        const contentType = storagePath.endsWith(".wav") ? "audio/wav" 
          : storagePath.endsWith(".ogg") ? "audio/ogg" 
          : "audio/mpeg";
        
        return new Response(r2Resp.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=3600",
          },
        });
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
          .select("id, nome_completo, email, telefone, data_nascimento, endereco_fixo, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_referencia, tem_filhos, mora_com_agressor, onboarding_completo, avatar_url, retencao_dias_sem_risco, compartilhar_gps_panico, compartilhar_gps_risco_alto, gps_duracao_minutos")
          .eq("id", userId)
          .single();
        return json({ success: true, usuario: data });
      }

      case "updateMe": {
        const allowed = ["nome_completo", "telefone", "data_nascimento", "endereco_fixo", "endereco_cep", "endereco_logradouro", "endereco_numero", "endereco_complemento", "endereco_bairro", "endereco_cidade", "endereco_uf", "endereco_referencia", "tem_filhos", "mora_com_agressor", "onboarding_completo", "avatar_url", "retencao_dias_sem_risco", "compartilhar_gps_panico", "compartilhar_gps_risco_alto", "gps_duracao_minutos"];
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

      case "createAgressor": {
        const { nome, data_nascimento, telefone, nome_pai_parcial, nome_mae_parcial, forca_seguranca, tem_arma_em_casa, tipo_vinculo } = params;
        if (!nome?.trim()) return json({ error: "Nome do agressor é obrigatório" }, 400);
        if (!tipo_vinculo?.trim()) return json({ error: "Tipo de vínculo é obrigatório" }, 400);

        // Create aggressor record
        const { data: agressor, error: aErr } = await supabase
          .from("agressores")
          .insert({
            nome: nome.trim(),
            data_nascimento: data_nascimento || null,
            telefone: telefone ? telefone.replace(/\D/g, "") : null,
            nome_pai_parcial: nome_pai_parcial?.trim() || null,
            nome_mae_parcial: nome_mae_parcial?.trim() || null,
            forca_seguranca: forca_seguranca || false,
            tem_arma_em_casa: tem_arma_em_casa || false,
          })
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

        await supabase.from("audit_logs").insert([
          { user_id: userId, action_type: "aggressor_created", success: true, details: { agressor_id: agressor.id } },
          { user_id: userId, action_type: "aggressor_linked", success: true, details: { agressor_id: agressor.id, tipo_vinculo } },
        ]);

        return json({ success: true, agressor_id: agressor.id }, 201);
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

        // Enrich with agressor details (only the user's own links)
        const enriched = await Promise.all((data || []).map(async (v: any) => {
          const { data: ag } = await supabase
            .from("agressores")
            .select("nome, data_nascimento, telefone, forca_seguranca, tem_arma_em_casa")
            .eq("id", v.agressor_id)
            .single();
          return { ...v, agressor: ag };
        }));

        return json({ success: true, vinculos: enriched });
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
