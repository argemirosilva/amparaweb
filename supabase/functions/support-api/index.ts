import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
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

async function requireAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (roles || []).some(
    (r: any) => r.role === "admin_master" || r.role === "admin_tenant" || r.role === "operador"
  );
}

function generateCode6(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1000000).padStart(6, "0");
}

async function hashCode(code: string): Promise<string> {
  return await hashToken(code);
}

async function addTimeline(supabase: any, userId: string, sessionId: string, eventType: string, description: string) {
  await supabase.from("support_audit_timeline").insert({
    user_id: userId,
    session_id: sessionId,
    event_type: eventType,
    description,
  });
}

async function revokeAllGrantsForSession(supabase: any, sessionId: string) {
  const { data: requests } = await supabase
    .from("support_access_requests")
    .select("id")
    .eq("session_id", sessionId);
  if (!requests || requests.length === 0) return;

  const requestIds = requests.map((r: any) => r.id);
  await supabase
    .from("support_access_grants")
    .update({ active: false, revoked_at: new Date().toISOString(), revoked_by: "system" })
    .in("request_id", requestIds)
    .eq("active", true);
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

    const userId = await authenticateSession(supabase, session_token);
    if (!userId) return json({ error: "Sessão inválida ou expirada" }, 401);

    // ================================================================
    // AGENT ACTIONS (require admin role)
    // ================================================================

    if (action === "listSessions") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { status, category, agent_id, page = 0, limit = 20 } = params;
      let query = supabase
        .from("support_sessions")
        .select("*, usuarios!support_sessions_user_id_fkey(nome_completo, email)")
        .order("last_activity_at", { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (status) query = query.eq("status", status);
      if (category) query = query.eq("category", category);
      if (agent_id) query = query.eq("agent_id", agent_id);

      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ sessions: data || [] });
    }

    if (action === "getSession") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { session_id } = params;
      if (!session_id) return json({ error: "session_id obrigatório" }, 400);

      const { data: session } = await supabase
        .from("support_sessions")
        .select("*, usuarios!support_sessions_user_id_fkey(id, nome_completo, email, telefone, created_at, status)")
        .eq("id", session_id)
        .single();
      if (!session) return json({ error: "Sessão não encontrada" }, 404);

      const { data: messages } = await supabase
        .from("support_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true });

      const { data: requests } = await supabase
        .from("support_access_requests")
        .select("*, support_access_grants(*)")
        .eq("session_id", session_id)
        .order("created_at", { ascending: false });

      return json({ session, messages: messages || [], access_requests: requests || [] });
    }

    if (action === "createSession") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { target_user_id, category = "other", sensitivity_level = "normal" } = params;
      if (!target_user_id) return json({ error: "target_user_id obrigatório" }, 400);

      const { data: targetUser } = await supabase
        .from("usuarios")
        .select("id")
        .eq("id", target_user_id)
        .single();
      if (!targetUser) return json({ error: "Usuária não encontrada" }, 404);

      const { data: session, error } = await supabase
        .from("support_sessions")
        .insert({
          user_id: target_user_id,
          agent_id: userId,
          status: "open",
          category,
          sensitivity_level,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);

      await addTimeline(supabase, target_user_id, session.id, "session_created",
        "Sessão de suporte técnico criada.");
      await addTimeline(supabase, target_user_id, session.id, "agent_assigned",
        "Agente de suporte atribuído à sessão.");

      await supabase.from("support_messages").insert({
        session_id: session.id,
        sender_type: "system",
        message_text: "Sessão de suporte técnico iniciada.",
      });

      return json({ session }, 201);
    }

    if (action === "sendMessage") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { session_id, message_text } = params;
      if (!session_id || !message_text?.trim()) return json({ error: "session_id e message_text obrigatórios" }, 400);

      const { data: msg, error } = await supabase
        .from("support_messages")
        .insert({
          session_id,
          sender_type: "agent",
          sender_id: userId,
          message_text: message_text.trim(),
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);

      await supabase
        .from("support_sessions")
        .update({ last_activity_at: new Date().toISOString(), status: "active" })
        .eq("id", session_id);

      return json({ message: msg }, 201);
    }

    if (action === "assignAgent") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { session_id, agent_id: newAgentId } = params;
      if (!session_id) return json({ error: "session_id obrigatório" }, 400);

      const targetAgent = newAgentId || userId;
      const { error } = await supabase
        .from("support_sessions")
        .update({ agent_id: targetAgent, last_activity_at: new Date().toISOString() })
        .eq("id", session_id);
      if (error) return json({ error: error.message }, 500);

      const { data: sess } = await supabase
        .from("support_sessions")
        .select("user_id")
        .eq("id", session_id)
        .single();
      if (sess) {
        await addTimeline(supabase, sess.user_id, session_id, "agent_assigned",
          "Agente de suporte reatribuído.");
      }

      return json({ success: true });
    }

    if (action === "closeSession") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { session_id } = params;
      if (!session_id) return json({ error: "session_id obrigatório" }, 400);

      await revokeAllGrantsForSession(supabase, session_id);

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("support_sessions")
        .update({ status: "closed", closed_at: now, last_activity_at: now })
        .eq("id", session_id);
      if (error) return json({ error: error.message }, 500);

      await supabase.from("support_messages").insert({
        session_id,
        sender_type: "system",
        message_text: "Sessão encerrada. Todos os acessos foram revogados.",
      });

      const { data: sess } = await supabase
        .from("support_sessions")
        .select("user_id")
        .eq("id", session_id)
        .single();
      if (sess) {
        await addTimeline(supabase, sess.user_id, session_id, "session_closed",
          "Sessão de suporte encerrada. Todos os acessos foram revogados.");
      }

      return json({ success: true });
    }

    // ========== ACCESS CONTROL ==========

    if (action === "requestAccess") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { session_id, resource_type, resource_id, requested_scope, justification_text } = params;
      if (!session_id || !resource_type || !resource_id || !requested_scope || !justification_text?.trim()) {
        return json({ error: "Todos os campos são obrigatórios: session_id, resource_type, resource_id, requested_scope, justification_text" }, 400);
      }

      const { data: sess } = await supabase
        .from("support_sessions")
        .select("user_id, status")
        .eq("id", session_id)
        .single();
      if (!sess) return json({ error: "Sessão não encontrada" }, 404);
      if (sess.status === "closed") return json({ error: "Sessão já encerrada" }, 400);

      const code = generateCode6();
      const codeHash = await hashCode(code);
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      const { data: request, error } = await supabase
        .from("support_access_requests")
        .insert({
          session_id,
          agent_id: userId,
          user_id: sess.user_id,
          resource_type,
          resource_id,
          requested_scope,
          justification_text: justification_text.trim(),
          code_hash: codeHash,
          code_expires_at: expiresAt,
          status: "pending",
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);

      await supabase
        .from("support_sessions")
        .update({ status: "waiting_consent", last_activity_at: new Date().toISOString() })
        .eq("id", session_id);

      await addTimeline(supabase, sess.user_id, session_id, "access_requested",
        `Agente solicitou acesso a ${resource_type}. Justificativa: ${justification_text.trim().substring(0, 100)}`);

      await supabase.from("support_messages").insert({
        session_id,
        sender_type: "system",
        message_text: `Solicitação de acesso enviada. Aguardando código de consentimento da usuária. Recurso: ${resource_type}, Escopo: ${requested_scope}`,
      });

      return json({ request_id: request.id, code, expires_at: expiresAt }, 201);
    }

    if (action === "confirmAccess") {
      const { request_id, code } = params;
      if (!request_id || !code) return json({ error: "request_id e code obrigatórios" }, 400);

      const { data: request } = await supabase
        .from("support_access_requests")
        .select("*")
        .eq("id", request_id)
        .single();
      if (!request) return json({ error: "Solicitação não encontrada" }, 404);

      // Verify user owns this request (if not admin)
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin && request.user_id !== userId) return json({ error: "Acesso negado" }, 403);

      if (request.status === "blocked") return json({ error: "Solicitação bloqueada por excesso de tentativas" }, 403);
      if (request.status !== "pending") return json({ error: `Solicitação já processada: ${request.status}` }, 400);

      if (new Date(request.code_expires_at) < new Date()) {
        await supabase
          .from("support_access_requests")
          .update({ status: "expired" })
          .eq("id", request_id);
        return json({ error: "Código expirado" }, 410);
      }

      const inputHash = await hashCode(code);
      if (inputHash !== request.code_hash) {
        const newAttempts = request.attempts + 1;
        const newStatus = newAttempts >= 3 ? "blocked" : "pending";
        await supabase
          .from("support_access_requests")
          .update({ attempts: newAttempts, status: newStatus })
          .eq("id", request_id);

        if (newStatus === "blocked") {
          await addTimeline(supabase, request.user_id, request.session_id, "access_revoked",
            "Solicitação bloqueada: 3 tentativas incorretas.");
        }
        return json({ error: `Código incorreto. Tentativa ${newAttempts}/3.` }, 401);
      }

      const grantExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { data: grant, error: grantErr } = await supabase
        .from("support_access_grants")
        .insert({
          request_id,
          expires_at: grantExpiresAt,
          active: true,
        })
        .select()
        .single();
      if (grantErr) return json({ error: grantErr.message }, 500);

      await supabase
        .from("support_access_requests")
        .update({ status: "granted" })
        .eq("id", request_id);

      await supabase
        .from("support_sessions")
        .update({ status: "active", last_activity_at: new Date().toISOString() })
        .eq("id", request.session_id);

      await addTimeline(supabase, request.user_id, request.session_id, "access_granted",
        `Acesso concedido a ${request.resource_type} (${request.requested_scope}). Expira em 10 minutos.`);

      await supabase.from("support_messages").insert({
        session_id: request.session_id,
        sender_type: "system",
        message_text: `✅ Acesso concedido. O agente pode visualizar ${request.resource_type} por 10 minutos.`,
      });

      return json({ grant });
    }

    if (action === "revokeAccess") {
      const { grant_id, revoked_by: revokedByParam = "agent" } = params;
      if (!grant_id) return json({ error: "grant_id obrigatório" }, 400);

      const { data: grant } = await supabase
        .from("support_access_grants")
        .select("*, support_access_requests(session_id, user_id, resource_type)")
        .eq("id", grant_id)
        .single();
      if (!grant) return json({ error: "Grant não encontrado" }, 404);

      await supabase
        .from("support_access_grants")
        .update({ active: false, revoked_at: new Date().toISOString(), revoked_by: revokedByParam })
        .eq("id", grant_id);

      const req = grant.support_access_requests;
      if (req) {
        await addTimeline(supabase, req.user_id, req.session_id, "access_revoked",
          `Acesso a ${req.resource_type} revogado por ${revokedByParam}.`);

        await supabase.from("support_messages").insert({
          session_id: req.session_id,
          sender_type: "system",
          message_text: `🔒 Acesso a ${req.resource_type} foi revogado.`,
        });
      }

      return json({ success: true });
    }

    if (action === "getResource") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { grant_id, resource_type, resource_id } = params;
      if (!grant_id || !resource_type || !resource_id) {
        return json({ error: "grant_id, resource_type e resource_id obrigatórios" }, 400);
      }

      const { data: grant } = await supabase
        .from("support_access_grants")
        .select("*, support_access_requests(session_id, user_id, agent_id, resource_type, resource_id, requested_scope)")
        .eq("id", grant_id)
        .eq("active", true)
        .single();

      if (!grant) return json({ error: "Grant não encontrado ou inativo" }, 403);
      if (new Date(grant.expires_at) < new Date()) {
        await supabase
          .from("support_access_grants")
          .update({ active: false, revoked_by: "system" })
          .eq("id", grant_id);
        return json({ error: "Grant expirado" }, 410);
      }

      const accessReq = grant.support_access_requests;
      if (accessReq.resource_type !== resource_type || accessReq.resource_id !== resource_id) {
        return json({ error: "Grant não corresponde ao recurso solicitado" }, 403);
      }

      await supabase.from("support_data_access_log").insert({
        session_id: accessReq.session_id,
        agent_id: userId,
        user_id: accessReq.user_id,
        resource_type,
        resource_id,
        action: `view_${accessReq.requested_scope.replace("read_", "")}`,
        grant_id,
      });

      await addTimeline(supabase, accessReq.user_id, accessReq.session_id, "data_accessed",
        `Agente acessou ${resource_type} (${accessReq.requested_scope}).`);

      let resourceData: any = null;

      if (resource_type === "recording") {
        const scope = accessReq.requested_scope;
        if (scope === "read_metadata") {
          const { data } = await supabase
            .from("gravacoes")
            .select("id, created_at, duracao_segundos, tamanho_mb, status, device_id, timezone")
            .eq("id", resource_id)
            .eq("user_id", accessReq.user_id)
            .single();
          resourceData = data;
        } else if (scope === "read_transcription") {
          const { data } = await supabase
            .from("gravacoes")
            .select("id, transcricao")
            .eq("id", resource_id)
            .eq("user_id", accessReq.user_id)
            .single();
          resourceData = data;
        } else if (scope === "read_audio_stream") {
          const { data: rec } = await supabase
            .from("gravacoes")
            .select("storage_path")
            .eq("id", resource_id)
            .eq("user_id", accessReq.user_id)
            .single();
          if (rec?.storage_path) {
            resourceData = { storage_path: rec.storage_path, stream_hint: "Use proxyAudio via web-api with this path" };
          }
        } else if (scope === "read_analysis") {
          const { data } = await supabase
            .from("gravacoes_analises")
            .select("id, resumo, nivel_risco, sentimento, categorias, palavras_chave, created_at")
            .eq("gravacao_id", resource_id)
            .eq("user_id", accessReq.user_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          resourceData = data;
        } else if (scope === "read_logs") {
          const { data } = await supabase
            .from("device_status")
            .select("*")
            .eq("user_id", accessReq.user_id)
            .order("updated_at", { ascending: false })
            .limit(20);
          resourceData = data;
        }
      } else if (resource_type === "analysis") {
        const { data } = await supabase
          .from("gravacoes_analises")
          .select("id, resumo, nivel_risco, sentimento, categorias, palavras_chave, created_at")
          .eq("id", resource_id)
          .eq("user_id", accessReq.user_id)
          .single();
        resourceData = data;
      } else if (resource_type === "transcription") {
        const { data } = await supabase
          .from("gravacoes")
          .select("id, transcricao")
          .eq("id", resource_id)
          .eq("user_id", accessReq.user_id)
          .single();
        resourceData = data;
      } else if (resource_type === "metadata") {
        const { data } = await supabase
          .from("gravacoes")
          .select("id, created_at, duracao_segundos, tamanho_mb, status, device_id")
          .eq("id", resource_id)
          .eq("user_id", accessReq.user_id)
          .single();
        resourceData = data;
      } else if (resource_type === "logs") {
        const { data } = await supabase
          .from("device_status")
          .select("*")
          .eq("user_id", accessReq.user_id)
          .order("updated_at", { ascending: false })
          .limit(20);
        resourceData = data;
      }

      if (!resourceData) return json({ error: "Recurso não encontrado" }, 404);
      return json({ resource: resourceData });
    }

    if (action === "listUserResources") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { target_user_id, resource_type = "recording" } = params;
      if (!target_user_id) return json({ error: "target_user_id obrigatório" }, 400);

      let items: any[] = [];

      if (resource_type === "recording" || resource_type === "transcription" || resource_type === "metadata") {
        const { data } = await supabase
          .from("gravacoes")
          .select("id, created_at, duracao_segundos, status, transcricao")
          .eq("user_id", target_user_id)
          .order("created_at", { ascending: false })
          .limit(50);
        items = (data || []).map((r: any) => ({
          id: r.id,
          label: `Gravação ${new Date(r.created_at).toLocaleDateString("pt-BR")} ${new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${r.duracao_segundos ? Math.round(r.duracao_segundos) + "s" : "?"}) — ${r.status}`,
          has_transcription: !!r.transcricao,
        }));
      } else if (resource_type === "analysis") {
        const { data } = await supabase
          .from("gravacoes_analises")
          .select("id, created_at, nivel_risco, resumo, gravacao_id")
          .eq("user_id", target_user_id)
          .order("created_at", { ascending: false })
          .limit(50);
        items = (data || []).map((a: any) => ({
          id: a.id,
          label: `Análise ${new Date(a.created_at).toLocaleDateString("pt-BR")} — Risco: ${a.nivel_risco || "?"}`,
        }));
      } else if (resource_type === "logs") {
        // For logs, just return a single virtual resource
        items = [{ id: target_user_id, label: "Logs do dispositivo (últimos 20)" }];
      }

      return json({ success: true, data: { items } });
    }

    if (action === "initiatePasswordReset") {
      const isAdmin = await requireAdmin(supabase, userId);
      if (!isAdmin) return json({ error: "Acesso negado" }, 403);

      const { session_id, target_user_id } = params;
      if (!session_id || !target_user_id) return json({ error: "session_id e target_user_id obrigatórios" }, 400);

      const { data: user } = await supabase
        .from("usuarios")
        .select("email, nome_completo")
        .eq("id", target_user_id)
        .single();
      if (!user) return json({ error: "Usuária não encontrada" }, 404);

      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auth-request-reset`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ email: user.email }),
        });
      } catch (e) {
        console.error("Password reset error:", e);
        return json({ error: "Erro ao enviar email de reset" }, 500);
      }

      await addTimeline(supabase, target_user_id, session_id, "password_reset_initiated",
        "Reset de senha iniciado pelo suporte. Link enviado para o email cadastrado.");

      await supabase.from("support_messages").insert({
        session_id,
        sender_type: "system",
        message_text: "🔑 Reset de senha iniciado. Link enviado para o email da usuária.",
      });

      return json({ success: true });
    }

    // ================================================================
    // USER ACTIONS (regular user)
    // ================================================================

    if (action === "myTickets") {
      const { limit = 20 } = params;

      // Also check for active grants per session
      const { data, error } = await supabase
        .from("support_sessions")
        .select("id, status, category, sensitivity_level, created_at, closed_at, last_activity_at")
        .eq("user_id", userId)
        .order("last_activity_at", { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);

      // Check active grants for each session
      const sessionsWithGrants = [];
      for (const sess of (data || [])) {
        const { data: reqs } = await supabase
          .from("support_access_requests")
          .select("id, support_access_grants(id, active, expires_at)")
          .eq("session_id", sess.id);
        
        const hasActiveGrant = (reqs || []).some((r: any) =>
          (r.support_access_grants || []).some((g: any) => g.active && new Date(g.expires_at) > new Date())
        );

        sessionsWithGrants.push({ ...sess, has_active_grant: hasActiveGrant });
      }

      return json({ success: true, data: { items: sessionsWithGrants } });
    }

    if (action === "createUserSession") {
      const { category = "other", message_text, linked_resource } = params;
      if (!message_text?.trim() || message_text.trim().length < 10) {
        return json({ error: "Mensagem deve ter pelo menos 10 caracteres" }, 400);
      }

      const validCategories = [
        "app_issue", "playback", "upload", "gps", "notifications", 
        "account", "recording_question", "transcription_question", 
        "analysis_question", "other"
      ];
      if (!validCategories.includes(category)) {
        return json({ error: "Categoria inválida" }, 400);
      }

      // Determine sensitivity
      const sensitiveCategories = ["recording_question", "transcription_question", "analysis_question"];
      const sensitivity_level = sensitiveCategories.includes(category) || linked_resource ? "sensitive" : "normal";

      const { data: session, error } = await supabase
        .from("support_sessions")
        .insert({
          user_id: userId,
          status: "open",
          category,
          sensitivity_level,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);

      await addTimeline(supabase, userId, session.id, "session_created",
        "Chamado de suporte técnico aberto.");

      // Send initial message
      await supabase.from("support_messages").insert({
        session_id: session.id,
        sender_type: "system",
        message_text: "Chamado aberto. Um agente será atribuído em breve.",
      });

      // User's message
      let userMsgText = message_text.trim();
      if (linked_resource?.resource_type && linked_resource?.resource_id) {
        const label = linked_resource.resource_label || linked_resource.resource_id;
        userMsgText += `\n\n📎 Recurso vinculado: ${linked_resource.resource_type} — ${label}`;
      }

      await supabase.from("support_messages").insert({
        session_id: session.id,
        sender_type: "user",
        sender_id: userId,
        message_text: userMsgText,
      });

      return json({ success: true, data: { session_id: session.id } }, 201);
    }

    if (action === "getMySession") {
      const { session_id } = params;
      if (!session_id) return json({ error: "session_id obrigatório" }, 400);

      const { data: session } = await supabase
        .from("support_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();
      if (!session) return json({ error: "Sessão não encontrada" }, 404);

      const { data: messages } = await supabase
        .from("support_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true });

      const { data: grants } = await supabase
        .from("support_access_requests")
        .select("id, resource_type, resource_id, requested_scope, justification_text, status, code_expires_at, created_at, support_access_grants(id, active, expires_at, revoked_at)")
        .eq("session_id", session_id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      return json({ success: true, data: { session, messages: messages || [], access_requests: grants || [] } });
    }

    if (action === "listMessages") {
      const { session_id, limit = 50 } = params;
      if (!session_id) return json({ error: "session_id obrigatório" }, 400);

      // Verify session belongs to user
      const { data: sess } = await supabase
        .from("support_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();
      if (!sess) return json({ error: "Sessão não encontrada" }, 404);

      const { data, error } = await supabase
        .from("support_messages")
        .select("id, sender_type, message_text, created_at")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);

      return json({ success: true, data: { items: data || [] } });
    }

    if (action === "sendUserMessage") {
      const { session_id, message_text } = params;
      if (!session_id || !message_text?.trim()) return json({ error: "session_id e message_text obrigatórios" }, 400);

      const { data: sess } = await supabase
        .from("support_sessions")
        .select("id, status")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();
      if (!sess) return json({ error: "Sessão não encontrada" }, 404);
      if (sess.status === "closed") return json({ error: "Sessão já encerrada" }, 400);

      const { data: msg, error } = await supabase
        .from("support_messages")
        .insert({
          session_id,
          sender_type: "user",
          sender_id: userId,
          message_text: message_text.trim(),
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);

      await supabase
        .from("support_sessions")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", session_id);

      return json({ success: true, data: { message: msg } }, 201);
    }

    if (action === "listAccessRequests") {
      const { session_id } = params;
      if (!session_id) return json({ error: "session_id obrigatório" }, 400);

      const { data: sess } = await supabase
        .from("support_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();
      if (!sess) return json({ error: "Sessão não encontrada" }, 404);

      const { data, error } = await supabase
        .from("support_access_requests")
        .select("id, resource_type, resource_id, requested_scope, justification_text, status, code_expires_at, created_at, support_access_grants(id, active, expires_at, revoked_at)")
        .eq("session_id", session_id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      return json({ success: true, data: { items: data || [] } });
    }

    if (action === "showCode") {
      const { request_id } = params;
      if (!request_id) return json({ error: "request_id obrigatório" }, 400);

      const { data: request } = await supabase
        .from("support_access_requests")
        .select("*")
        .eq("id", request_id)
        .eq("user_id", userId)
        .single();
      if (!request) return json({ error: "Solicitação não encontrada" }, 404);

      if (request.status !== "pending") {
        return json({ error: `Solicitação já processada: ${request.status}` }, 400);
      }

      // If code expired, generate a new one
      if (new Date(request.code_expires_at) < new Date()) {
        const newCode = generateCode6();
        const newHash = await hashCode(newCode);
        const newExpires = new Date(Date.now() + 2 * 60 * 1000).toISOString();

        await supabase
          .from("support_access_requests")
          .update({ code_hash: newHash, code_expires_at: newExpires, attempts: 0 })
          .eq("id", request_id);

        await addTimeline(supabase, userId, request.session_id, "code_shown",
          `Novo código de consentimento gerado para acesso a ${request.resource_type}.`);

        return json({ success: true, data: { code: newCode, expires_at: newExpires } });
      }

      // Code still valid — regenerate (since we can't retrieve the original from hash)
      const newCode = generateCode6();
      const newHash = await hashCode(newCode);
      const newExpires = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      await supabase
        .from("support_access_requests")
        .update({ code_hash: newHash, code_expires_at: newExpires, attempts: 0 })
        .eq("id", request_id);

      await addTimeline(supabase, userId, request.session_id, "code_shown",
        `Código de consentimento exibido para acesso a ${request.resource_type}.`);

      return json({ success: true, data: { code: newCode, expires_at: newExpires } });
    }

    if (action === "denyAccess") {
      const { request_id } = params;
      if (!request_id) return json({ error: "request_id obrigatório" }, 400);

      const { data: request } = await supabase
        .from("support_access_requests")
        .select("*")
        .eq("id", request_id)
        .eq("user_id", userId)
        .single();
      if (!request) return json({ error: "Solicitação não encontrada" }, 404);

      if (request.status !== "pending") {
        return json({ error: `Solicitação já processada: ${request.status}` }, 400);
      }

      await supabase
        .from("support_access_requests")
        .update({ status: "denied" })
        .eq("id", request_id);

      await supabase
        .from("support_sessions")
        .update({ status: "active", last_activity_at: new Date().toISOString() })
        .eq("id", request.session_id);

      await addTimeline(supabase, userId, request.session_id, "access_revoked",
        `Acesso a ${request.resource_type} recusado pela usuária.`);

      await supabase.from("support_messages").insert({
        session_id: request.session_id,
        sender_type: "system",
        message_text: `❌ Acesso a ${request.resource_type} recusado pela usuária.`,
      });

      return json({ success: true });
    }

    if (action === "getAuditTimeline") {
      const { session_id } = params;
      let query = supabase
        .from("support_audit_timeline")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (session_id) query = query.eq("session_id", session_id);

      const { data, error } = await query.limit(100);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, data: { items: data || [] } });
    }

    if (action === "getPendingConsent") {
      const { data, error } = await supabase
        .from("support_access_requests")
        .select("id, session_id, resource_type, requested_scope, justification_text, code_expires_at, created_at")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      return json({ success: true, data: { pending: data || [] } });
    }

    if (action === "revokeAllAccess") {
      const { session_id } = params;
      if (!session_id) return json({ error: "session_id obrigatório" }, 400);

      const { data: sess } = await supabase
        .from("support_sessions")
        .select("id")
        .eq("id", session_id)
        .eq("user_id", userId)
        .single();
      if (!sess) return json({ error: "Sessão não encontrada" }, 404);

      await revokeAllGrantsForSession(supabase, session_id);

      await addTimeline(supabase, userId, session_id, "access_revoked",
        "Todos os acessos revogados pela usuária.");

      await supabase.from("support_messages").insert({
        session_id,
        sender_type: "system",
        message_text: "🔒 Todos os acessos foram revogados pela usuária.",
      });

      return json({ success: true });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    console.error("support-api error:", err);
    return json({ error: err.message || "Erro interno" }, 500);
  }
});
