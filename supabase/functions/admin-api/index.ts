import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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

function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function anonymize(text: string): string {
  if (!text) return "";
  let t = text;
  // CPF
  t = t.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "*********");
  // Phone
  t = t.replace(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, "*********");
  // Email
  t = t.replace(/\S+@\S+\.\S+/g, "*********");
  // CEP
  t = t.replace(/\d{5}-?\d{3}/g, "*********");
  // Addresses (Rua/Av/Travessa/Alameda + text until comma or end)
  t = t.replace(/(Rua|Av\.?|Avenida|Travessa|Alameda|Praça|Estrada)\s+[^,.\n]+[,.]?\s*(n[°ºo]?\s*\d+)?/gi, "*********");
  // Sequences of capitalized words (likely proper names)
  t = t.replace(/(?<![.?!]\s)(?:(?:[A-ZÀ-Ú][a-zà-ú]{1,}\s+){1,}[A-ZÀ-Ú][a-zà-ú]{1,})/g, "*********");
  return t;
}

function anonymizeJson(obj: any): any {
  if (typeof obj === "string") return anonymize(obj);
  if (Array.isArray(obj)) return obj.map(anonymizeJson);
  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) result[k] = anonymizeJson(v);
    return result;
  }
  return obj;
}

async function authenticateAdmin(supabase: any, sessionToken: string): Promise<string | null> {
  if (!sessionToken) return null;
  const tokenHash = await hashToken(sessionToken);
  const { data: session } = await supabase
    .from("user_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!session || new Date(session.expires_at) < new Date()) return null;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id);

  const hasAdmin = (roles || []).some(
    (r: any) => r.role === "super_administrador" || r.role === "administrador" || r.role === "admin_master" || r.role === "admin_tenant"
  );
  if (!hasAdmin) return null;
  return session.user_id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { action, session_token, ...params } = body;

    if (!session_token) return json({ error: "Sessão não informada" }, 401);

    const userId = await authenticateAdmin(supabase, session_token);
    if (!userId) return json({ error: "Acesso negado. Permissão de administrador necessária." }, 403);

    // ========== CREATE USER (Admin invite) ==========
    if (action === "createUser") {
      const { nome_completo, email, tenant_id, role, app_url } = params;

      if (!nome_completo?.trim() || !email?.trim()) {
        return json({ error: "Nome e email são obrigatórios" }, 400);
      }

      const emailClean = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailClean)) {
        return json({ error: "Email inválido" }, 400);
      }

      if (!tenant_id) {
        return json({ error: "Órgão é obrigatório" }, 400);
      }

      const allRoles = ["super_administrador", "administrador", "admin_master", "admin_tenant", "operador", "suporte"];
      const highRoles = ["super_administrador", "administrador"];
      let validRole = allRoles.includes(role) ? role : "operador";

      // Only allow assigning high-level roles if the caller is also a high-level admin
      if (highRoles.includes(validRole)) {
        const { data: callerRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const callerIsHighAdmin = (callerRoles || []).some((r: any) => highRoles.includes(r.role));
        if (!callerIsHighAdmin) {
          validRole = "operador";
        }
      }

      // Check if email already exists
      const { data: existing } = await supabase
        .from("usuarios")
        .select("id")
        .eq("email", emailClean)
        .maybeSingle();

      if (existing) {
        return json({ error: "Este email já está cadastrado" }, 409);
      }

      // Generate invite token and random unusable password
      const inviteToken = generateSecureToken(32);
      const tokenExpira = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h
      const randomPassword = generateSecureToken(32);
      const senhaHash = bcrypt.hashSync(randomPassword);

      // Insert user
      const { data: newUser, error: insertError } = await supabase
        .from("usuarios")
        .insert({
          nome_completo: nome_completo.trim(),
          email: emailClean,
          telefone: "",
          senha_hash: senhaHash,
          status: "pendente",
          email_verificado: false,
          codigo_verificacao: inviteToken,
          codigo_verificacao_expira: tokenExpira,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert user error:", insertError);
        return json({ error: "Erro ao criar usuário: " + insertError.message }, 500);
      }

      // Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: newUser.id,
          role: validRole,
          tenant_id: tenant_id,
        });

      if (roleError) {
        console.error("Insert role error:", roleError);
        // Rollback user creation
        await supabase.from("usuarios").delete().eq("id", newUser.id);
        return json({ error: "Erro ao atribuir papel: " + roleError.message }, 500);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "admin_create_user",
        success: true,
        details: { created_user_id: newUser.id, email: emailClean, role: validRole, tenant_id },
      });

      // Send invite email
      const baseUrl = app_url || "https://ampamamulher.lovable.app";
      const setupLink = `${baseUrl}/configurar-conta?token=${inviteToken}&email=${encodeURIComponent(emailClean)}`;

      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auth-send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            email: emailClean,
            nome: nome_completo.trim(),
            tipo: "convite",
            link: setupLink,
          }),
        });
      } catch (e) {
        console.error("Email send error:", e);
      }

      return json({ success: true, user_id: newUser.id });
    }

    // ========== TENANTS ==========
    if (action === "listTenants") {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("nome");
      if (error) return json({ error: error.message }, 500);

      // Count active users per tenant (v2)
      const { data: counts } = await supabase
        .from("user_roles")
        .select("tenant_id, user_id")
        .not("tenant_id", "is", null);

      const countMap: Record<string, number> = {};
      if (counts) {
        const seen = new Set<string>();
        for (const row of counts) {
          const key = `${row.tenant_id}:${row.user_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            countMap[row.tenant_id] = (countMap[row.tenant_id] || 0) + 1;
          }
        }
      }

      const tenants = (data || []).map((t: any) => ({
        ...t,
        usuarios_ativos: countMap[t.id] || 0,
      }));

      return json({ tenants });
    }

    if (action === "createTenant") {
      const { tenant } = params;
      if (!tenant?.nome || !tenant?.sigla) return json({ error: "Nome e sigla são obrigatórios" }, 400);
      const { data, error } = await supabase
        .from("tenants")
        .insert(tenant)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ tenant: data });
    }

    if (action === "updateTenant") {
      const { id, updates } = params;
      if (!id) return json({ error: "ID não informado" }, 400);
      const { data, error } = await supabase
        .from("tenants")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ tenant: data });
    }

    if (action === "deleteTenant") {
      const { id } = params;
      if (!id) return json({ error: "ID não informado" }, 400);
      const { error } = await supabase
        .from("tenants")
        .delete()
        .eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ========== ADMIN SETTINGS ==========
    if (action === "listSettings") {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .order("categoria")
        .order("updated_at");
      if (error) return json({ error: error.message }, 500);
      return json({ settings: data });
    }

    if (action === "updateSetting") {
      const { id, valor } = params;
      if (!id || valor === undefined) return json({ error: "ID e valor são obrigatórios" }, 400);
      const { data, error } = await supabase
        .from("admin_settings")
        .update({ valor: String(valor), updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ setting: data });
    }

    // ========== UPDATE USER ==========
    if (action === "updateUser") {
      const { user_id: targetUserId, nome_completo, email, status, tenant_id, role } = params;

      if (!targetUserId) return json({ error: "ID do usuário não informado" }, 400);
      if (!nome_completo?.trim()) return json({ error: "Nome é obrigatório" }, 400);
      if (!email?.trim()) return json({ error: "Email é obrigatório" }, 400);

      const emailClean = email.trim().toLowerCase();
      const validStatuses = ["ativo", "pendente", "inativo", "bloqueado"];
      const finalStatus = validStatuses.includes(status) ? status : "pendente";

      // Check if email is taken by another user
      const { data: existing } = await supabase
        .from("usuarios")
        .select("id")
        .eq("email", emailClean)
        .neq("id", targetUserId)
        .maybeSingle();

      if (existing) {
        return json({ error: "Este email já está em uso por outro usuário" }, 409);
      }

      // Update user
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({
          nome_completo: nome_completo.trim(),
          email: emailClean,
          status: finalStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId);

      if (updateError) {
        return json({ error: "Erro ao atualizar: " + updateError.message }, 500);
      }

      // Restrict 'super_administrador' and 'administrador' role assignment to existing super_administrador/administrador
      if (role === "super_administrador" || role === "administrador") {
        const { data: callerRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        const isCallerAdmin = (callerRoles || []).some((r: any) => r.role === "super_administrador" || r.role === "administrador");
        if (!isCallerAdmin) {
          return json({ error: "Somente administradores podem atribuir esse nível" }, 403);
        }
      }

      // Update role / tenant association
      await supabase.from("user_roles").delete().eq("user_id", targetUserId);
      if (role) {
        await supabase.from("user_roles").insert({
          user_id: targetUserId,
          role: role,
          tenant_id: tenant_id || null,
        });
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "admin_update_user",
        success: true,
        details: { updated_user_id: targetUserId, email: emailClean, status: finalStatus, tenant_id },
      });

      return json({ success: true });
    }

    // ========== UPDATE USER STATUS (Block/Unblock) ==========
    if (action === "updateUserStatus") {
      const { user_id: targetUserId, status } = params;
      if (!targetUserId) return json({ error: "ID do usuário não informado" }, 400);

      const validStatuses = ["ativo", "pendente", "inativo", "bloqueado"];
      if (!validStatuses.includes(status)) return json({ error: "Status inválido" }, 400);

      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", targetUserId);

      if (updateError) return json({ error: "Erro ao atualizar status: " + updateError.message }, 500);

      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: status === "bloqueado" ? "admin_block_user" : "admin_unblock_user",
        success: true,
        details: { target_user_id: targetUserId, new_status: status },
      });

      return json({ success: true });
    }

    // ========== CREATE TEST TRACKING LINK ==========
    if (action === "createTestTrackingLink") {
      const { target_user_id, codigo } = params;
      if (!target_user_id || !codigo) {
        return json({ error: "target_user_id e codigo são obrigatórios" }, 400);
      }

      // Delete existing test links with same code
      await supabase
        .from("compartilhamento_gps")
        .delete()
        .eq("codigo", codigo)
        .eq("tipo", "teste");

      // Create new test tracking link (24h expiry)
      const { data: link, error: insertErr } = await supabase
        .from("compartilhamento_gps")
        .insert({
          user_id: target_user_id,
          codigo,
          tipo: "teste",
          ativo: true,
          expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("id, codigo")
        .single();

      if (insertErr) return json({ error: "Erro ao criar link: " + insertErr.message }, 500);

      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "admin_create_test_tracking_link",
        success: true,
        details: { target_user_id, codigo },
      });

      return json({ success: true, link });
    }

    // ========== DELETE USER ==========
    if (action === "deleteUser") {
      const { user_id: targetUserId } = params;
      if (!targetUserId) return json({ error: "ID do usuário não informado" }, 400);

      // Prevent self-deletion
      if (targetUserId === userId) {
        return json({ error: "Você não pode remover a si mesmo" }, 400);
      }

      // Only super_administrador / administrador can delete
      const { data: callerRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isCallerAdmin = (callerRoles || []).some(
        (r: any) => r.role === "super_administrador" || r.role === "administrador"
      );
      if (!isCallerAdmin) {
        return json({ error: "Somente administradores podem remover usuários" }, 403);
      }

      // Get user info for audit before deletion
      const { data: targetUser } = await supabase
        .from("usuarios")
        .select("email, nome_completo")
        .eq("id", targetUserId)
        .maybeSingle();

      // Delete related data first
      await supabase.from("user_roles").delete().eq("user_id", targetUserId);
      await supabase.from("user_sessions").delete().eq("user_id", targetUserId);
      await supabase.from("refresh_tokens").delete().eq("user_id", targetUserId);
      await supabase.from("guardioes").delete().eq("usuario_id", targetUserId);

      // Delete user
      const { error: deleteError } = await supabase
        .from("usuarios")
        .delete()
        .eq("id", targetUserId);

      if (deleteError) {
        return json({ error: "Erro ao remover usuário: " + deleteError.message }, 500);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "admin_delete_user",
        success: true,
        details: {
          deleted_user_id: targetUserId,
          email: targetUser?.email,
          nome: targetUser?.nome_completo,
        },
      });

      return json({ success: true });
    }

    // ========== ACTIVATE USER ==========
    if (action === "activateUser") {
      const { user_id: targetUserId } = params;
      if (!targetUserId) return json({ error: "ID do usuário não informado" }, 400);

      const { error: updateError } = await supabase
        .from("usuarios")
        .update({
          status: "ativo",
          email_verificado: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId);

      if (updateError) return json({ error: "Erro ao ativar: " + updateError.message }, 500);

      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "admin_activate_user",
        success: true,
        details: { target_user_id: targetUserId },
      });

      return json({ success: true });
    }

    // ========== CURADORIA: LIST ==========
    if (action === "listCuradoria") {
      // Check admin/super role
      const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isCurador = (callerRoles || []).some((r: any) => r.role === "super_administrador" || r.role === "administrador" || r.role === "suporte");
      if (!isCurador) return json({ error: "Acesso restrito a administradores" }, 403);

      const { nivel_risco, data_inicio, data_fim, somente_curadas, offset = 0, limit = 25 } = params;

      let query = supabase
        .from("gravacoes")
        .select("id, created_at, duracao_segundos, transcricao, gravacoes_analises!inner(id, nivel_risco, sentimento, categorias, palavras_chave, xingamentos, resumo, cupiado, gravacao_id)", { count: "exact" })
        .eq("status", "processado")
        .not("transcricao", "is", null)
        .neq("gravacoes_analises.nivel_risco", "sem_risco")
        .neq("gravacoes_analises.nivel_risco", "nenhum")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (nivel_risco) query = query.eq("gravacoes_analises.nivel_risco", nivel_risco);
      if (data_inicio) query = query.gte("created_at", data_inicio);
      if (data_fim) query = query.lte("created_at", data_fim);
      if (somente_curadas) {
        query = query.eq("gravacoes_analises.cupiado", true);
      } else {
        query = query.or("cupiado.is.null,cupiado.eq.false", { referencedTable: "gravacoes_analises" });
      }

      const { data: gravacoes, error: qErr, count } = await query;
      if (qErr) return json({ error: qErr.message }, 500);

      // Fetch micro results for these recordings
      const ids = (gravacoes || []).map((g: any) => g.id);
      let microMap: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: micros } = await supabase
          .from("analysis_micro_results")
          .select("recording_id, context_classification, cycle_phase, output_json")
          .in("recording_id", ids)
          .eq("latest", true);
        for (const m of micros || []) {
          microMap[m.recording_id] = m;
        }
      }

      // Fetch avaliacoes count per analise_id
      const allAnaliseIds = (gravacoes || []).map((g: any) => g.gravacoes_analises?.id).filter(Boolean);
      let avaliacoesCountMap: Record<string, number> = {};
      if (allAnaliseIds.length > 0) {
        const { data: avCounts } = await supabase
          .from("curadoria_avaliacoes")
          .select("analise_id")
          .in("analise_id", allAnaliseIds)
          .neq("status", "pendente");
        for (const av of avCounts || []) {
          avaliacoesCountMap[av.analise_id] = (avaliacoesCountMap[av.analise_id] || 0) + 1;
        }
      }

      const items = (gravacoes || []).map((g: any) => {
        const a = g.gravacoes_analises;
        const micro = microMap[g.id];
        return {
          id: g.id,
          analise_id: a?.id,
          created_at: g.created_at,
          duracao_segundos: g.duracao_segundos,
          transcricao_anonimizada: anonymize(g.transcricao || ""),
          nivel_risco: a?.nivel_risco,
          sentimento: a?.sentimento,
          categorias: a?.categorias,
          palavras_chave: a?.palavras_chave,
          xingamentos: a?.xingamentos,
          resumo_anonimizado: anonymize(a?.resumo || ""),
          cupiado: a?.cupiado || false,
          context_classification: micro?.context_classification || null,
          cycle_phase: micro?.cycle_phase || null,
          output_json_anonimizado: micro?.output_json ? anonymizeJson(micro.output_json) : null,
          avaliacoes_count: avaliacoesCountMap[a?.id] || 0,
        };
      });

      return json({ items, total: count || 0 });
    }

    // ========== CURADORIA: EXPORT ==========
    if (action === "exportCuradoria") {
      const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isCurador = (callerRoles || []).some((r: any) => r.role === "super_administrador" || r.role === "administrador" || r.role === "suporte");
      if (!isCurador) return json({ error: "Acesso restrito" }, 403);

      const { somente_curadas } = params;

      let query = supabase
        .from("gravacoes")
        .select("id, created_at, duracao_segundos, transcricao, gravacoes_analises!inner(id, nivel_risco, sentimento, categorias, palavras_chave, xingamentos, resumo, cupiado)")
        .eq("status", "processado")
        .not("transcricao", "is", null)
        .neq("gravacoes_analises.nivel_risco", "sem_risco")
        .neq("gravacoes_analises.nivel_risco", "nenhum")
        .order("created_at", { ascending: false });

      if (somente_curadas) query = query.eq("gravacoes_analises.cupiado", true);

      const { data: gravacoes, error: qErr } = await query;
      if (qErr) return json({ error: qErr.message }, 500);

      const ids = (gravacoes || []).map((g: any) => g.id);
      let microMap: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: micros } = await supabase
          .from("analysis_micro_results")
          .select("recording_id, context_classification, cycle_phase, output_json")
          .in("recording_id", ids)
          .eq("latest", true);
        for (const m of micros || []) microMap[m.recording_id] = m;
      }

      // Fetch avaliacoes for enriched export
      const allAnaliseIds = (gravacoes || []).map((g: any) => g.gravacoes_analises?.id).filter(Boolean);
      let avaliacoesMap: Record<string, any[]> = {};
      if (allAnaliseIds.length > 0) {
        const { data: avs } = await supabase
          .from("curadoria_avaliacoes")
          .select("analise_id, campo, status, valor_corrigido, nota")
          .in("analise_id", allAnaliseIds);
        for (const av of avs || []) {
          if (!avaliacoesMap[av.analise_id]) avaliacoesMap[av.analise_id] = [];
          avaliacoesMap[av.analise_id].push(av);
        }
      }

      const lines = (gravacoes || []).map((g: any) => {
        const a = g.gravacoes_analises;
        const micro = microMap[g.id];
        const avList = avaliacoesMap[a?.id] || [];
        const avaliacoes: Record<string, any> = {};
        for (const av of avList) {
          avaliacoes[av.campo] = { status: av.status, valor_corrigido: av.valor_corrigido, nota: av.nota };
        }
        return JSON.stringify({
          id: g.id,
          created_at: g.created_at,
          duracao_segundos: g.duracao_segundos,
          transcricao: anonymize(g.transcricao || ""),
          nivel_risco: a?.nivel_risco,
          sentimento: a?.sentimento,
          categorias: a?.categorias,
          palavras_chave: a?.palavras_chave,
          xingamentos: a?.xingamentos,
          resumo: anonymize(a?.resumo || ""),
          context_classification: micro?.context_classification || null,
          cycle_phase: micro?.cycle_phase || null,
          output_json: micro?.output_json ? anonymizeJson(micro.output_json) : null,
          avaliacoes: Object.keys(avaliacoes).length > 0 ? avaliacoes : undefined,
        });
      });

      return new Response(lines.join("\n"), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/jsonl", "Content-Disposition": "attachment; filename=curadoria_export.jsonl" },
      });
    }

    // ========== CURADORIA: TOGGLE ==========
    if (action === "toggleCuradoria") {
      const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isCurador = (callerRoles || []).some((r: any) => r.role === "super_administrador" || r.role === "administrador" || r.role === "suporte");
      if (!isCurador) return json({ error: "Acesso restrito" }, 403);

      const { analise_id, cupiado } = params;
      if (!analise_id) return json({ error: "analise_id obrigatório" }, 400);

      const { error: updErr } = await supabase
        .from("gravacoes_analises")
        .update({ cupiado: !!cupiado })
        .eq("id", analise_id);

      if (updErr) return json({ error: updErr.message }, 500);
      return json({ success: true });
    }

    // ========== CURADORIA: GET AVALIACOES ==========
    if (action === "getAvaliacoes") {
      const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isCurador = (callerRoles || []).some((r: any) => r.role === "super_administrador" || r.role === "administrador" || r.role === "suporte");
      if (!isCurador) return json({ error: "Acesso restrito" }, 403);

      const { analise_id } = params;
      if (!analise_id) return json({ error: "analise_id obrigatório" }, 400);

      const { data, error: qErr } = await supabase
        .from("curadoria_avaliacoes")
        .select("*")
        .eq("analise_id", analise_id);

      if (qErr) return json({ error: qErr.message }, 500);
      return json({ avaliacoes: data || [] });
    }

    // ========== CURADORIA: SAVE AVALIACAO ==========
    if (action === "saveAvaliacao") {
      const { data: callerRoles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const isCurador = (callerRoles || []).some((r: any) => r.role === "super_administrador" || r.role === "administrador" || r.role === "suporte");
      if (!isCurador) return json({ error: "Acesso restrito" }, 403);

      const { analise_id, campo, status: avStatus, valor_corrigido, nota } = params;
      if (!analise_id || !campo) return json({ error: "analise_id e campo são obrigatórios" }, 400);
      if (!["correto", "incorreto", "pendente"].includes(avStatus)) return json({ error: "status inválido" }, 400);

      const { error: upsertErr } = await supabase
        .from("curadoria_avaliacoes")
        .upsert({
          analise_id,
          campo,
          status: avStatus,
          valor_corrigido: valor_corrigido ?? null,
          nota: nota ?? null,
          avaliado_por: userId,
          avaliado_em: new Date().toISOString(),
        }, { onConflict: "analise_id,campo" });

      if (upsertErr) return json({ error: upsertErr.message }, 500);

      // Auto-mark as curada when all 8 campos are evaluated
      const TOTAL_CAMPOS = 8;
      const { data: allAvs } = await supabase
        .from("curadoria_avaliacoes")
        .select("campo")
        .eq("analise_id", analise_id)
        .neq("status", "pendente");
      const evaluatedCount = (allAvs || []).length;
      if (evaluatedCount >= TOTAL_CAMPOS) {
        await supabase
          .from("gravacoes_analises")
          .update({ cupiado: true })
          .eq("id", analise_id);
      }

      return json({ success: true, auto_cupiado: evaluatedCount >= TOTAL_CAMPOS });
    }

    // ========== TIPOS ALERTA CRUD ==========
    if (action === "listTiposAlerta") {
      const { data, error } = await supabase
        .from("tipos_alerta")
        .select("*")
        .order("grupo")
        .order("ordem");
      if (error) return json({ error: error.message }, 500);
      return json({ items: data });
    }

    if (action === "createTipoAlerta") {
      const { item } = params;
      if (!item?.codigo?.trim() || !item?.label?.trim() || !item?.grupo?.trim()) {
        return json({ error: "Código, label e grupo são obrigatórios" }, 400);
      }
      const { data, error } = await supabase
        .from("tipos_alerta")
        .insert({
          grupo: item.grupo.trim(),
          codigo: item.codigo.trim(),
          label: item.label.trim(),
          descricao: item.descricao?.trim() || null,
          ordem: item.ordem ?? 0,
          ativo: item.ativo !== false,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      await supabase.from("audit_logs").insert({
        user_id: userId, action_type: "admin_create_tipo_alerta", success: true,
        details: { tipo_alerta_id: data.id, codigo: data.codigo, grupo: data.grupo },
      });
      return json({ item: data });
    }

    if (action === "updateTipoAlerta") {
      const { id, updates } = params;
      if (!id) return json({ error: "ID não informado" }, 400);
      const { data, error } = await supabase
        .from("tipos_alerta")
        .update({ ...updates, updated_at: undefined })
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ item: data });
    }

    if (action === "deleteTipoAlerta") {
      const { id } = params;
      if (!id) return json({ error: "ID não informado" }, 400);
      const { error } = await supabase.from("tipos_alerta").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    return json({ error: err.message || "Erro interno" }, 500);
  }
});
