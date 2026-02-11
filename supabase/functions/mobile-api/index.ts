import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Utility functions ──

function generateToken(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(error: string, status = 400): Response {
  return jsonResponse({ success: false, error }, status);
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  identifier: string,
  actionType: string,
  limit: number,
  windowMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("rate_limit_attempts")
    .select("*", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("action_type", actionType)
    .gte("attempted_at", since);
  return (count || 0) >= limit;
}

async function validateSession(
  supabase: ReturnType<typeof createClient>,
  sessionToken: string
): Promise<{ user: Record<string, unknown> | null; error: string | null }> {
  if (!sessionToken) return { user: null, error: "session_token obrigatório" };

  const tokenHash = await hashToken(sessionToken);
  const { data: session } = await supabase
    .from("user_sessions")
    .select("id, user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!session || new Date(session.expires_at) < new Date()) {
    return { user: null, error: "Sessão inválida ou expirada" };
  }

  const { data: user } = await supabase
    .from("usuarios")
    .select("id, email, nome_completo, telefone, tipo_interesse")
    .eq("id", session.user_id)
    .single();

  return { user, error: null };
}

// ── Action Handlers ──

async function handleLogin(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const email = (body.email as string)?.trim().toLowerCase();
  const senha = body.senha as string;
  const tipoAcao = body.tipo_acao as string | undefined;

  if (!email || !senha) {
    return errorResponse("Email e senha são obrigatórios", 400);
  }

  // Rate limit
  const identifier = `${email}:${ip}`;
  const limited = await checkRateLimit(supabase, identifier, "login_mobile", 5, 15);
  if (limited) {
    return errorResponse("Muitas tentativas. Aguarde 15 minutos", 429);
  }

  await supabase.from("rate_limit_attempts").insert({
    identifier,
    action_type: "login_mobile",
  });

  // Find user
  const { data: user } = await supabase
    .from("usuarios")
    .select("id, email, nome_completo, telefone, tipo_interesse, senha_hash, senha_coacao_hash, status")
    .eq("email", email)
    .maybeSingle();

  if (!user) {
    return errorResponse("Email ou senha incorretos", 401);
  }

  // Check password (normal + coercion)
  let loginTipo = "normal";
  const normalMatch = bcrypt.compareSync(senha, user.senha_hash);
  const coercaoMatch = user.senha_coacao_hash
    ? bcrypt.compareSync(senha, user.senha_coacao_hash)
    : false;

  if (!normalMatch && !coercaoMatch) {
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "login_mobile_failed",
      success: false,
      ip_address: ip,
      details: { reason: "wrong_password" },
    });
    return errorResponse("Email ou senha incorretos", 401);
  }

  if (coercaoMatch && !normalMatch) {
    loginTipo = "coacao";
    // Silent alert for guardians
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "coacao_login",
      success: true,
      ip_address: ip,
      details: { silent: true },
    });
  }

  // Desinstalação event
  if (tipoAcao === "desinstalacao") {
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "app_desinstalacao",
      success: true,
      ip_address: ip,
    });
  }

  // Generate access_token (session)
  const accessToken = generateToken(64);
  const accessTokenHash = await hashToken(accessToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("user_sessions").insert({
    user_id: user.id,
    token_hash: accessTokenHash,
    expires_at: expiresAt,
    ip_address: ip,
  });

  // Generate refresh_token
  const refreshToken = generateToken(64); // 64 bytes = 128 hex chars
  const refreshTokenHash = await hashToken(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("refresh_tokens").insert({
    user_id: user.id,
    token_hash: refreshTokenHash,
    expires_at: refreshExpiresAt,
    ip_address: ip,
  });

  // Update last access
  await supabase.from("usuarios").update({ ultimo_acesso: new Date().toISOString() }).eq("id", user.id);

  // Audit
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action_type: "login_mobile_success",
    success: true,
    ip_address: ip,
  });

  return jsonResponse({
    success: true,
    usuario: {
      id: user.id,
      email: user.email,
      nome_completo: user.nome_completo,
      telefone: user.telefone,
      tipo_interesse: user.tipo_interesse,
    },
    loginTipo,
    session: {
      token: accessToken,
      expires_at: expiresAt,
    },
    refresh_token: refreshToken,
  });
}

async function handleRefreshToken(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const refreshTokenRaw = body.refresh_token as string;

  if (!refreshTokenRaw || refreshTokenRaw.length !== 128) {
    return errorResponse("refresh_token inválido", 401);
  }

  const tokenHash = await hashToken(refreshTokenRaw);

  // Find valid refresh token
  const { data: existing } = await supabase
    .from("refresh_tokens")
    .select("id, user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!existing || new Date(existing.expires_at) < new Date()) {
    return errorResponse("Refresh token inválido ou expirado", 401);
  }

  // Revoke current
  await supabase
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", existing.id);

  // Generate new access_token
  const newAccessToken = generateToken(64);
  const newAccessTokenHash = await hashToken(newAccessToken);
  const accessExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("user_sessions").insert({
    user_id: existing.user_id,
    token_hash: newAccessTokenHash,
    expires_at: accessExpiresAt,
    ip_address: ip,
  });

  // Generate new refresh_token
  const newRefreshToken = generateToken(64);
  const newRefreshTokenHash = await hashToken(newRefreshToken);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newRefresh } = await supabase
    .from("refresh_tokens")
    .insert({
      user_id: existing.user_id,
      token_hash: newRefreshTokenHash,
      expires_at: refreshExpiresAt,
      ip_address: ip,
    })
    .select("id")
    .single();

  // Link replaced_by
  if (newRefresh) {
    await supabase
      .from("refresh_tokens")
      .update({ replaced_by: newRefresh.id })
      .eq("id", existing.id);
  }

  // Get user
  const { data: user } = await supabase
    .from("usuarios")
    .select("id, email, nome_completo, telefone, tipo_interesse")
    .eq("id", existing.user_id)
    .single();

  return jsonResponse({
    success: true,
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    user,
  });
}

async function handlePing(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const sessionToken = body.session_token as string;
  const { user, error } = await validateSession(supabase, sessionToken);
  if (error || !user) {
    return errorResponse(error || "Sessão inválida", 401);
  }

  const deviceId = body.device_id as string | undefined;
  const userId = (user as Record<string, unknown>).id as string;

  if (deviceId) {
    // Upsert device_status
    const { data: existing } = await supabase
      .from("device_status")
      .select("id")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    const deviceData: Record<string, unknown> = {
      last_ping_at: new Date().toISOString(),
      status: "online",
    };

    if (body.bateria_percentual !== undefined) deviceData.bateria_percentual = body.bateria_percentual;
    if (body.is_charging !== undefined) deviceData.is_charging = body.is_charging;
    if (body.dispositivo_info !== undefined) deviceData.dispositivo_info = body.dispositivo_info;
    if (body.versao_app !== undefined) deviceData.versao_app = body.versao_app;
    if (body.is_recording !== undefined) deviceData.is_recording = body.is_recording;
    if (body.is_monitoring !== undefined) deviceData.is_monitoring = body.is_monitoring;
    if (body.timezone !== undefined) deviceData.timezone = body.timezone;
    if (body.timezone_offset_minutes !== undefined) deviceData.timezone_offset_minutes = body.timezone_offset_minutes;

    if (existing) {
      await supabase
        .from("device_status")
        .update(deviceData)
        .eq("id", existing.id);
    } else {
      await supabase.from("device_status").insert({
        user_id: userId,
        device_id: deviceId,
        ...deviceData,
      });
    }
  }

  return jsonResponse({
    success: true,
    status: "online",
    servidor_timestamp: new Date().toISOString(),
  });
}

async function handleSyncConfig(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();
  if (!emailUsuario) {
    return errorResponse("email_usuario obrigatório", 400);
  }

  const { data: user } = await supabase
    .from("usuarios")
    .select("id, email, nome_completo, telefone, tipo_interesse, status")
    .eq("email", emailUsuario)
    .maybeSingle();

  if (!user) {
    return errorResponse("Usuário não encontrado", 404);
  }

  // Get schedules
  const { data: agendamento } = await supabase
    .from("agendamentos_monitoramento")
    .select("periodos_semana, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const periodosSemana = agendamento?.periodos_semana || {};

  // Check if within scheduled window
  const deviceId = body.device_id as string | undefined;
  const timezone = body.timezone as string | undefined;
  const tzOffset = body.timezone_offset_minutes as number | undefined;
  let monitoramentoAtivo = false;
  let sessaoId: string | null = null;

  if (deviceId && agendamento) {
    // Calculate client time
    let clientNow: Date;
    if (tzOffset !== undefined) {
      const utcNow = new Date();
      clientNow = new Date(utcNow.getTime() - tzOffset * 60 * 1000);
    } else {
      clientNow = new Date();
    }

    const dayNames = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
    const dayName = dayNames[clientNow.getUTCDay()];
    const currentTime = `${String(clientNow.getUTCHours()).padStart(2, "0")}:${String(clientNow.getUTCMinutes()).padStart(2, "0")}`;

    const dayPeriods = (periodosSemana as Record<string, Array<{ inicio: string; fim: string }>>)[dayName];

    if (dayPeriods && Array.isArray(dayPeriods)) {
      for (const periodo of dayPeriods) {
        if (currentTime >= periodo.inicio && currentTime <= periodo.fim) {
          monitoramentoAtivo = true;

          // Check existing active session
          const { data: existingSession } = await supabase
            .from("monitoramento_sessoes")
            .select("id")
            .eq("user_id", user.id)
            .eq("device_id", deviceId)
            .eq("status", "ativa")
            .maybeSingle();

          if (!existingSession) {
            const { data: newSession } = await supabase
              .from("monitoramento_sessoes")
              .insert({
                user_id: user.id,
                device_id: deviceId,
                status: "ativa",
              })
              .select("id")
              .single();
            sessaoId = newSession?.id || null;
          } else {
            sessaoId = existingSession.id;
          }
          break;
        }
      }
    }

    // Update device timezone
    if (timezone || tzOffset !== undefined) {
      const tzUpdate: Record<string, unknown> = {};
      if (timezone) tzUpdate.timezone = timezone;
      if (tzOffset !== undefined) tzUpdate.timezone_offset_minutes = tzOffset;

      await supabase
        .from("device_status")
        .update(tzUpdate)
        .eq("user_id", user.id)
        .eq("device_id", deviceId);
    }
  }

  return jsonResponse({
    success: true,
    usuario: {
      id: user.id,
      email: user.email,
      nome_completo: user.nome_completo,
      telefone: user.telefone,
      tipo_interesse: user.tipo_interesse,
      status: user.status,
    },
    monitoramento: {
      ativo: monitoramentoAtivo,
      sessao_id: sessaoId,
      periodos_semana: periodosSemana,
    },
    servidor_timestamp: new Date().toISOString(),
  });
}

// ── Stub for unimplemented actions ──

function stubResponse(): Response {
  return jsonResponse({ success: false, error: "NOT_IMPLEMENTED" }, 501);
}

// ── Main Router ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Método não permitido", 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const action = body.action as string;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    if (!action) {
      return errorResponse("Campo 'action' é obrigatório", 400);
    }

    switch (action) {
      // ── Fase 1: Implemented ──
      case "loginCustomizado":
        return await handleLogin(body, supabase, ip);
      case "refresh_token":
        return await handleRefreshToken(body, supabase, ip);
      case "pingMobile":
        return await handlePing(body, supabase);
      case "syncConfigMobile":
        return await handleSyncConfig(body, supabase);

      // ── Stubs: 501 ──
      case "logoutMobile":
      case "validate_password":
      case "change_password":
      case "update_schedules":
      case "enviarLocalizacaoGPS":
      case "acionarPanicoMobile":
      case "cancelarPanicoMobile":
      case "receberAudioMobile":
      case "getAudioSignedUrl":
      case "reprocessarGravacao":
      case "reprocess_recording":
      case "reportarStatusMonitoramento":
      case "reportarStatusGravacao":
        return stubResponse();

      default:
        return errorResponse("Action desconhecida", 400);
    }
  } catch (err) {
    console.error("mobile-api error:", err);
    return errorResponse("Erro interno do servidor", 500);
  }
});
