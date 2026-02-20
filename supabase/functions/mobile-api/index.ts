import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
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

async function findUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("usuarios")
    .select("id, email, nome_completo, telefone, tipo_interesse")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return data;
}

// ── Fire-and-forget WhatsApp notification ──

function fireWhatsApp(userId: string, tipo: string, lat?: number | null, lon?: number | null, alertaId?: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const body: Record<string, unknown> = { action: "notify_alert", user_id: userId, tipo };
  if (lat != null) body.lat = lat;
  if (lon != null) body.lon = lon;
  if (alertaId) body.alerta_id = alertaId;

  fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch((e) => console.error("fireWhatsApp error:", e));
}

function fireWhatsAppResolved(userId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "notify_resolved", user_id: userId }),
  }).catch((e) => console.error("fireWhatsAppResolved error:", e));
}

// ── Fire-and-forget COPOM outbound call ──

function fireCopomCall(userId: string, alertaId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Build minimal context server-side for the COPOM call
  (async () => {
    try {
      const sb = createClient(supabaseUrl, serviceKey);

      // Fetch user profile
      const { data: user } = await sb
        .from("usuarios")
        .select("id, nome_completo, telefone, configuracao_alertas")
        .eq("id", userId)
        .single();

      if (!user) {
        console.error("fireCopomCall: user not found", userId);
        return;
      }

      // Check if COPOM auto-call is enabled in user config
      const alertConfig = user.configuracao_alertas as Record<string, unknown> || {};
      const acionamentos = alertConfig.acionamentos as Record<string, unknown> | undefined;
      if (acionamentos) {
        // Check the correct key: autoridades_190_180.critico (set by the UI)
        const autoridadesConfig = acionamentos.autoridades_190_180 as Record<string, boolean> | undefined;
        // Also support legacy key: copom_chamada_automatica.ativo
        const copomLegacy = acionamentos.copom_chamada_automatica as Record<string, boolean> | undefined;
        const isEnabled = autoridadesConfig?.critico === true || copomLegacy?.ativo === true;
        if (!isEnabled) {
          console.log("fireCopomCall: user has COPOM auto-call disabled, skipping. autoridades_190_180:", JSON.stringify(autoridadesConfig), "copom_legacy:", JSON.stringify(copomLegacy));
          return;
        }
      } else {
        // No acionamentos config at all — default is disabled
        console.log("fireCopomCall: no acionamentos config, skipping (default off)");
        return;
      }

      // Fetch latest location
      const { data: loc } = await sb
        .from("localizacoes")
        .select("latitude, longitude, precisao_metros, speed")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch linked aggressor
      const { data: vinculo } = await sb
        .from("vitimas_agressores")
        .select("agressor_id, tipo_vinculo")
        .eq("usuario_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let agressorNome: string | null = null;
      let agressorMasked: string | null = null;
      let agressorTemArma = false;
      let agressorForcaSeguranca = false;
      let agressorForcaTipo: string | null = null;
      let agressorVehicle: { model?: string; color?: string; plate_partial?: string } = {};
      if (vinculo?.agressor_id) {
        const { data: agr } = await sb
          .from("agressores")
          .select("nome, display_name_masked, tem_arma_em_casa, forca_seguranca, sector, vehicles")
          .eq("id", vinculo.agressor_id)
          .single();
        agressorNome = agr?.nome ?? null;
        agressorMasked = agr?.display_name_masked ?? null;
        agressorTemArma = agr?.tem_arma_em_casa ?? false;
        agressorForcaSeguranca = agr?.forca_seguranca ?? false;
        agressorForcaTipo = agr?.sector ?? null;
        const vehicles = agr?.vehicles as unknown[];
        const firstV = Array.isArray(vehicles) && vehicles.length > 0 ? (vehicles[0] as Record<string, string>) : null;
        if (firstV) {
          agressorVehicle = {
            model: firstV.model_hint ?? undefined,
            color: firstV.color ?? undefined,
            plate_partial: firstV.plate_partial ?? firstV.plate_prefix ?? undefined,
          };
        }
      }

      // Fetch GPS sharing link
      const { data: share } = await sb
        .from("compartilhamento_gps")
        .select("codigo")
        .eq("user_id", userId)
        .eq("ativo", true)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Resolve address via Nominatim (best-effort)
      let address: string | null = null;
      if (loc?.latitude && loc?.longitude) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.latitude}&lon=${loc.longitude}&format=json&accept-language=pt-BR`,
            { headers: { "User-Agent": "AMPARA/1.0 (contato@amparamulher.com.br)" } }
          );
          const geo = await geoRes.json();
          if (geo?.display_name) {
            // Strip city, state, CEP — keep only street + neighborhood
            let basic = (geo.display_name as string).replace(/\s*-\s*[A-Z]{2}$/, "");
            const parts = basic.split(",").map((p: string) => p.trim());
            if (parts.length >= 3) basic = parts.slice(0, -1).join(", ");
            // Remove country
            basic = basic.replace(/,\s*Brasil$/i, "");
            address = basic;
          }
        } catch { /* no address */ }
      }

      // Classify movement
      const speedKmh = loc?.speed != null ? Math.round((loc.speed as number) * 3.6) : null;
      let movStatus = "DESCONHECIDO";
      if (speedKmh !== null) {
        if (speedKmh < 1) movStatus = "PARADA";
        else if (speedKmh < 8) movStatus = "CAMINHANDO";
        else movStatus = "VEICULO";
      }

      // Mask phone
      let phoneMasked: string | null = null;
      if (user.telefone) {
        const digits = (user.telefone as string).replace(/\D/g, "");
        if (digits.length >= 8) {
          phoneMasked = `(${digits.slice(0, 2)}) ****-${digits.slice(-4)}`;
        }
      }

      const monitoringLink = share?.codigo
        ? `ampamamulher.lovable.app/${share.codigo}`
        : "";

      const context = {
        victim: { name: user.nome_completo, phone_masked: phoneMasked },
        aggressor: {
          name: agressorNome,
          name_masked: agressorMasked,
          tem_arma: agressorTemArma,
          forca_seguranca: agressorForcaSeguranca,
          forca_seguranca_tipo: agressorForcaTipo,
          vehicle: agressorVehicle,
        },
        location: { address, movement_status: movStatus },
        monitoring_link: monitoringLink,
        victim_aggressor_relation: vinculo?.tipo_vinculo ?? null,
        protocol_id: alertaId,
      };

      // Call the COPOM outbound-call edge function
      await fetch(`${supabaseUrl}/functions/v1/copom-outbound-call`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context,
          user_id: userId,
          skip_cooldown: true,
        }),
      });

      console.log("fireCopomCall: COPOM outbound call dispatched for user", userId);
    } catch (e) {
      console.error("fireCopomCall error:", e);
    }
  })();
}

// ── Short day keys used throughout the API (doc standard) ──
const VALID_DAYS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
// JS getDay() -> short key mapping (0=Sunday)
const DAY_INDEX_TO_KEY = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

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
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "coacao_login",
      success: true,
      ip_address: ip,
      details: { silent: true },
    });

    // Fire-and-forget: notify guardians about coercion login
    fireWhatsApp(user.id, "coacao");
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
  const refreshToken = generateToken(64);
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

  if (newRefresh) {
    await supabase
      .from("refresh_tokens")
      .update({ replaced_by: newRefresh.id })
      .eq("id", existing.id);
  }

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
    else if (body.device_model !== undefined) deviceData.dispositivo_info = body.device_model;
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
      // New device — remove all previous devices for this user
      await supabase
        .from("device_status")
        .delete()
        .eq("user_id", userId)
        .neq("device_id", deviceId);

      console.log(`Replaced old device(s) for user ${userId}, new device: ${deviceId}`);

      await supabase.from("device_status").insert({
        user_id: userId,
        device_id: deviceId,
        ...deviceData,
      });
    }
  }

  // Optional GPS: if latitude & longitude are present, insert into localizacoes
  const pingLat = body.latitude as number | undefined;
  const pingLon = body.longitude as number | undefined;
  if (pingLat !== undefined && pingLon !== undefined) {
    const locData: Record<string, unknown> = {
      user_id: userId,
      device_id: deviceId || null,
      latitude: pingLat,
      longitude: pingLon,
    };
    if (body.location_accuracy != null) locData.precisao_metros = Number(body.location_accuracy);
    if (body.location_timestamp) {
      const raw = body.location_timestamp;
      // Accept both ISO string and Unix millis
      const ts = typeof raw === "number" ? new Date(raw).toISOString() : typeof raw === "string" && /^\d+$/.test(raw) ? new Date(Number(raw)).toISOString() : raw as string;
      locData.timestamp_gps = ts;
    }
    if (body.speed != null) locData.speed = Number(body.speed);
    if (body.heading != null) locData.heading = Number(body.heading);
    if (body.bateria_percentual != null) locData.bateria_percentual = Number(body.bateria_percentual);

    // Link to active panic alert if any
    const { data: activePanic } = await supabase
      .from("alertas_panico")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "ativo")
      .maybeSingle();
    if (activePanic) locData.alerta_id = activePanic.id;

    const { error: locError } = await supabase.from("localizacoes").insert(locData);
    if (locError) console.error(`[handlePing] loc insert error: ${locError.message}`);
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
  const sessionToken = body.session_token as string;
  if (!sessionToken) {
    return errorResponse("session_token obrigatório", 401);
  }

  const { user: sessionUser, error: sessionError } = await validateSession(supabase, sessionToken);
  if (sessionError || !sessionUser) {
    return errorResponse(sessionError || "Sessão inválida", 401);
  }

  const userId = (sessionUser as Record<string, unknown>).id as string;

  // Fetch full user data including status and configuracao_alertas
  const { data: user } = await supabase
    .from("usuarios")
    .select("id, email, nome_completo, telefone, tipo_interesse, status, configuracao_alertas")
    .eq("id", userId)
    .single();

  if (!user) {
    return errorResponse("Usuário não encontrado", 404);
  }

  // Get schedules
  const { data: agendamento } = await supabase
    .from("agendamentos_monitoramento")
    .select("periodos_semana, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const periodosSemana = (agendamento?.periodos_semana || {}) as Record<string, Array<{ inicio: string; fim: string }>>;


  // Check if within scheduled window
  const deviceId = body.device_id as string | undefined;
  const timezone = body.timezone as string | undefined;
  const tzOffset = body.timezone_offset_minutes as number | undefined;

  let gravacaoAtiva = false;
  let dentroHorario = false;
  let periodoAtualIndex: number | null = null;
  let gravacaoInicio: string | null = null;
  let gravacaoFim: string | null = null;
  let sessaoId: string | null = null;

  // Calculate client time
  let clientNow: Date;
  if (tzOffset !== undefined) {
    const utcNow = new Date();
    clientNow = new Date(utcNow.getTime() - tzOffset * 60 * 1000);
  } else {
    // Default to America/Sao_Paulo (UTC-3)
    const utcNow = new Date();
    clientNow = new Date(utcNow.getTime() + 3 * 60 * 60 * 1000 * -1);
  }

  const dayKey = DAY_INDEX_TO_KEY[clientNow.getUTCDay()];
  const currentTime = `${String(clientNow.getUTCHours()).padStart(2, "0")}:${String(clientNow.getUTCMinutes()).padStart(2, "0")}`;

  // Get today's periods
  const periodosHoje = periodosSemana[dayKey] || [];

  // Check all configured days for gravacao_ativa_config
  const gravacaoAtivaConfig = Object.values(periodosSemana).some(
    (periods) => Array.isArray(periods) && periods.length > 0
  );

  if (periodosHoje.length > 0) {
    for (let i = 0; i < periodosHoje.length; i++) {
      const periodo = periodosHoje[i];
      if (currentTime >= periodo.inicio && currentTime <= periodo.fim) {
        dentroHorario = true;
        gravacaoAtiva = true;
        periodoAtualIndex = i;
        gravacaoInicio = periodo.inicio;
        gravacaoFim = periodo.fim;

        if (deviceId && agendamento) {
          // Check existing active session for this user+device
          const { data: existingSession } = await supabase
            .from("monitoramento_sessoes")
            .select("id")
            .eq("user_id", user.id)
            .eq("device_id", deviceId)
            .eq("status", "ativa")
            .maybeSingle();

          if (!existingSession) {
            // Calculate window_start_at and window_end_at in UTC
            const [hi, mi] = periodo.inicio.split(":").map(Number);
            const [hf, mf] = periodo.fim.split(":").map(Number);

            const windowStartLocal = new Date(clientNow);
            windowStartLocal.setUTCHours(hi, mi, 0, 0);
            const windowEndLocal = new Date(clientNow);
            windowEndLocal.setUTCHours(hf, mf, 0, 0);

            let windowStartUtc: Date;
            let windowEndUtc: Date;
            if (tzOffset !== undefined) {
              windowStartUtc = new Date(windowStartLocal.getTime() + tzOffset * 60 * 1000);
              windowEndUtc = new Date(windowEndLocal.getTime() + tzOffset * 60 * 1000);
            } else {
              windowStartUtc = new Date(windowStartLocal.getTime() + 3 * 60 * 60 * 1000);
              windowEndUtc = new Date(windowEndLocal.getTime() + 3 * 60 * 60 * 1000);
            }

            const { data: newSession } = await supabase
              .from("monitoramento_sessoes")
              .insert({
                user_id: user.id,
                device_id: deviceId,
                status: "ativa",
                window_start_at: windowStartUtc.toISOString(),
                window_end_at: windowEndUtc.toISOString(),
                origem: "automatico",
              })
              .select("id")
              .single();
            sessaoId = newSession?.id || null;
          } else {
            sessaoId = existingSession.id;
          }
        }
        break;
      }
    }
  }

  // Update device timezone
  if (deviceId && (timezone || tzOffset !== undefined)) {
    const tzUpdate: Record<string, unknown> = {};
    if (timezone) tzUpdate.timezone = timezone;
    if (tzOffset !== undefined) tzUpdate.timezone_offset_minutes = tzOffset;

    await supabase
      .from("device_status")
      .update(tzUpdate)
      .eq("user_id", user.id)
      .eq("device_id", deviceId);
  }

  // Build dias_gravacao from configured schedule
  const diasGravacao: string[] = [];
  const dayLabels: Record<string, string> = {
    seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta",
    sex: "Sexta", sab: "Sábado", dom: "Domingo",
  };
  for (const d of VALID_DAYS) {
    if (periodosSemana[d] && periodosSemana[d].length > 0) {
      diasGravacao.push(dayLabels[d]);
    }
  }

  const syncPayload = {
    success: true,
    gravacao_ativa: gravacaoAtiva,
    gravacao_ativa_config: gravacaoAtivaConfig,
    dentro_horario: dentroHorario,
    periodo_atual_index: periodoAtualIndex,
    gravacao_inicio: gravacaoInicio,
    gravacao_fim: gravacaoFim,
    periodos_hoje: periodosHoje,
    sessao_id: sessaoId,
    dias_gravacao: diasGravacao,
    usuario: {
      id: user.id,
      email: user.email,
      nome_completo: user.nome_completo,
      telefone: user.telefone,
      tipo_interesse: user.tipo_interesse,
      status: user.status,
    },
    monitoramento: {
      ativo: gravacaoAtiva,
      sessao_id: sessaoId,
      periodos_semana: periodosSemana,
    },
    servidor_timestamp: new Date().toISOString(),
  };
  console.log("[SYNC_RESPONSE]", JSON.stringify(syncPayload));
  return jsonResponse(syncPayload);
}

// ── Fase 2 Handlers ──

async function handleLogout(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const sessionToken = body.session_token as string;
  const deviceId = body.device_id as string;

  if (!sessionToken) return errorResponse("session_token obrigatório", 400);
  if (!deviceId) return errorResponse("device_id obrigatório", 400);

  const { user, error } = await validateSession(supabase, sessionToken);
  if (error || !user) return errorResponse(error || "Sessão inválida", 401);

  const userId = (user as Record<string, unknown>).id as string;

  // Check active panic for this device
  const { data: activePanic } = await supabase
    .from("alertas_panico")
    .select("id")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .eq("status", "ativo")
    .maybeSingle();

  if (activePanic) {
    return jsonResponse({ success: false, error: "PANIC_ACTIVE_CANNOT_LOGOUT" }, 403);
  }

  // Revoke session
  const tokenHash = await hashToken(sessionToken);
  await supabase
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  // Audit
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action_type: "logout_mobile",
    success: true,
    ip_address: ip,
    details: { device_id: deviceId },
  });

  return jsonResponse({ success: true, message: "Logout realizado com sucesso" });
}

async function handleValidatePassword(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const sessionToken = body.session_token as string;
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();
  const senha = body.senha as string;

  if (!sessionToken) return errorResponse("session_token obrigatório", 400);
  if (!emailUsuario || !senha) return errorResponse("email_usuario e senha obrigatórios", 400);

  const { user: sessionUser, error } = await validateSession(supabase, sessionToken);
  if (error || !sessionUser) return errorResponse(error || "Sessão inválida", 401);

  const identifier = `${emailUsuario}:${ip}`;
  const limited = await checkRateLimit(supabase, identifier, "validate_password", 5, 15);
  if (limited) return errorResponse("Muitas tentativas. Aguarde 15 minutos", 429);

  await supabase.from("rate_limit_attempts").insert({
    identifier,
    action_type: "validate_password",
  });

  const { data: user } = await supabase
    .from("usuarios")
    .select("id, senha_hash, senha_coacao_hash")
    .eq("email", emailUsuario)
    .maybeSingle();

  if (!user) return errorResponse("Usuário não encontrado", 404);

  const normalMatch = bcrypt.compareSync(senha, user.senha_hash);
  const coercaoMatch = user.senha_coacao_hash
    ? bcrypt.compareSync(senha, user.senha_coacao_hash)
    : false;

  if (!normalMatch && !coercaoMatch) {
    return errorResponse("Senha incorreta", 401);
  }

  let loginTipo = "normal";
  if (coercaoMatch && !normalMatch) {
    loginTipo = "coacao";
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "coacao_validate_password",
      success: true,
      ip_address: ip,
      details: { silent: true },
    });
  }

  return jsonResponse({ success: true, loginTipo });
}

async function handleChangePassword(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const sessionToken = body.session_token as string;
  const senhaAtual = body.senha_atual as string;
  const novaSenha = body.nova_senha as string;

  if (!sessionToken) return errorResponse("session_token obrigatório", 400);
  if (!senhaAtual || !novaSenha) return errorResponse("senha_atual e nova_senha obrigatórios", 400);
  if (novaSenha.length < 6) return errorResponse("Nova senha inválida", 400);

  const { user, error } = await validateSession(supabase, sessionToken);
  if (error || !user) return errorResponse(error || "Sessão inválida ou expirada", 401);

  const userId = (user as Record<string, unknown>).id as string;
  const userEmail = (user as Record<string, unknown>).email as string;

  const identifier = `${userEmail}:${ip}`;
  const limited = await checkRateLimit(supabase, identifier, "change_password", 5, 15);
  if (limited) return errorResponse("Muitas tentativas. Aguarde 15 minutos.", 429);

  const { data: fullUser } = await supabase
    .from("usuarios")
    .select("senha_hash, senha_coacao_hash")
    .eq("id", userId)
    .single();

  if (!fullUser) return errorResponse("Usuário não encontrado", 404);

  const comunOk = bcrypt.compareSync(senhaAtual, fullUser.senha_hash);
  const coercaoOk = fullUser.senha_coacao_hash
    ? bcrypt.compareSync(senhaAtual, fullUser.senha_coacao_hash)
    : false;

  if (comunOk) {
    const novaSenhaHash = bcrypt.hashSync(novaSenha);
    await supabase
      .from("usuarios")
      .update({ senha_hash: novaSenhaHash, updated_at: new Date().toISOString() })
      .eq("id", userId);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action_type: "change_password",
      success: true,
      ip_address: ip,
      details: { mode: "real_change" },
    });

    return jsonResponse({ success: true, message: "Senha alterada com sucesso" });
  }

  if (coercaoOk) {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action_type: "change_password",
      success: true,
      ip_address: ip,
      details: { mode: "coercion_fake_success" },
    });

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action_type: "coercion_event",
      success: true,
      ip_address: ip,
      details: { event: "COERCION_PASSWORD_CHANGE", source: "change_password" },
    });

    return jsonResponse({ success: true, message: "Senha alterada com sucesso" });
  }

  await supabase.from("rate_limit_attempts").insert({
    identifier,
    action_type: "change_password",
  });

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action_type: "change_password",
    success: false,
    ip_address: ip,
    details: { reason: "invalid_current_password" },
  });

  return errorResponse("Senha atual incorreta", 401);
}

async function handleChangeCoercionPassword(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const sessionToken = body.session_token as string;
  const senhaAtual = body.senha_atual as string;
  const novaSenhaCoacao = body.nova_senha_coacao as string;

  if (!sessionToken) return errorResponse("session_token obrigatório", 400);
  if (!senhaAtual || !novaSenhaCoacao) return errorResponse("senha_atual e nova_senha_coacao obrigatórios", 400);
  if (novaSenhaCoacao.length < 6) return errorResponse("Nova senha de coação inválida", 400);

  const { user, error } = await validateSession(supabase, sessionToken);
  if (error || !user) return errorResponse(error || "Sessão inválida ou expirada", 401);

  const userId = (user as Record<string, unknown>).id as string;
  const userEmail = (user as Record<string, unknown>).email as string;

  const identifier = `${userEmail}:${ip}`;
  const limited = await checkRateLimit(supabase, identifier, "change_coercion_password", 5, 15);
  if (limited) return errorResponse("Muitas tentativas. Aguarde 15 minutos.", 429);

  const { data: fullUser } = await supabase
    .from("usuarios")
    .select("senha_hash, senha_coacao_hash")
    .eq("id", userId)
    .single();

  if (!fullUser) return errorResponse("Usuário não encontrado", 404);

  // Must authenticate with NORMAL password to change coercion password
  const comunOk = bcrypt.compareSync(senhaAtual, fullUser.senha_hash);
  const coercaoOk = fullUser.senha_coacao_hash
    ? bcrypt.compareSync(senhaAtual, fullUser.senha_coacao_hash)
    : false;

  // If coercion password was used, fake success (anti-coercion pattern)
  if (coercaoOk && !comunOk) {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action_type: "change_coercion_password",
      success: true,
      ip_address: ip,
      details: { mode: "coercion_fake_success" },
    });

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action_type: "coercion_event",
      success: true,
      ip_address: ip,
      details: { event: "COERCION_PASSWORD_CHANGE", source: "change_coercion_password" },
    });

    return jsonResponse({ success: true, message: "Senha de segurança alterada com sucesso" });
  }

  if (comunOk) {
    // Ensure coercion password is different from normal password
    if (bcrypt.compareSync(novaSenhaCoacao, fullUser.senha_hash)) {
      return errorResponse("A senha de segurança deve ser diferente da senha principal", 400);
    }

    const novaSenhaCoacaoHash = bcrypt.hashSync(novaSenhaCoacao);
    await supabase
      .from("usuarios")
      .update({ senha_coacao_hash: novaSenhaCoacaoHash, updated_at: new Date().toISOString() })
      .eq("id", userId);

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action_type: "change_coercion_password",
      success: true,
      ip_address: ip,
      details: { mode: "real_change" },
    });

    return jsonResponse({ success: true, message: "Senha de segurança alterada com sucesso" });
  }

  // Wrong password
  await supabase.from("rate_limit_attempts").insert({
    identifier,
    action_type: "change_coercion_password",
  });

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action_type: "change_coercion_password",
    success: false,
    ip_address: ip,
    details: { reason: "invalid_current_password" },
  });

  return errorResponse("Senha atual incorreta", 401);
}

async function handleUpdateSchedules(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const sessionToken = body.session_token as string;
  const periodosSemana = body.periodos_semana as Record<string, unknown>;

  if (!sessionToken) return errorResponse("session_token obrigatório", 400);
  if (periodosSemana === undefined) return errorResponse("periodos_semana obrigatório", 400);

  const { user, error } = await validateSession(supabase, sessionToken);
  if (error || !user) return errorResponse(error || "Sessão inválida", 401);

  const userId = (user as Record<string, unknown>).id as string;

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

  for (const [day, periods] of Object.entries(periodosSemana)) {
    if (!VALID_DAYS.includes(day)) {
      return errorResponse(`Dia inválido: ${day}`, 400);
    }
    if (!Array.isArray(periods)) {
      return errorResponse(`Períodos do dia ${day} devem ser um array`, 400);
    }
    let totalMinutes = 0;
    for (const p of periods as Array<{ inicio: string; fim: string }>) {
      if (!p.inicio || !p.fim || !timeRegex.test(p.inicio) || !timeRegex.test(p.fim)) {
        return errorResponse(`Formato HH:MM inválido em ${day}`, 400);
      }
      if (p.inicio >= p.fim) {
        return errorResponse(`Período inválido em ${day}: inicio deve ser antes de fim`, 400);
      }
      const [hi, mi] = p.inicio.split(":").map(Number);
      const [hf, mf] = p.fim.split(":").map(Number);
      totalMinutes += (hf * 60 + mf) - (hi * 60 + mi);
    }
    if (totalMinutes > 8 * 60) {
      return errorResponse(`Limite de 8h/dia excedido em ${day}`, 400);
    }
  }

  const { data: existing } = await supabase
    .from("agendamentos_monitoramento")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("agendamentos_monitoramento")
      .update({ periodos_semana: periodosSemana })
      .eq("id", existing.id);
  } else {
    await supabase.from("agendamentos_monitoramento").insert({
      user_id: userId,
      periodos_semana: periodosSemana,
    });
  }

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action_type: "update_schedules",
    success: true,
    ip_address: ip,
  });

  return jsonResponse({
    success: true,
    message: "Horários atualizados com sucesso",
    periodos_atualizados: periodosSemana,
  });
}

// ── Fase 3 Handlers ──

function generateProtocolo(): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AMP-${dateStr}-${rand}`;
}

async function handleEnviarLocalizacaoGPS(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();
  if (!emailUsuario) return errorResponse("email_usuario obrigatório", 400);

  const latitude = body.latitude as number;
  const longitude = body.longitude as number;
  if (latitude === undefined || longitude === undefined) {
    return errorResponse("latitude e longitude obrigatórios", 400);
  }

  const { data: user } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", emailUsuario)
    .maybeSingle();

  if (!user) return errorResponse("Usuário não encontrado", 404);

  const deviceId = body.device_id as string | undefined;
  const alertaId = body.alerta_id as string | undefined;

  if (alertaId && !deviceId) {
    return jsonResponse({ success: false, error: "DEVICE_ID_REQUIRED" }, 400);
  }

  const { data: activePanic } = await supabase
    .from("alertas_panico")
    .select("id, device_id")
    .eq("user_id", user.id)
    .eq("status", "ativo")
    .maybeSingle();

  const { data: activeMonitor } = await supabase
    .from("monitoramento_sessoes")
    .select("id, device_id")
    .eq("user_id", user.id)
    .eq("status", "ativa")
    .maybeSingle();

  if ((activePanic || activeMonitor) && !deviceId) {
    return jsonResponse({ success: false, error: "DEVICE_ID_REQUIRED" }, 400);
  }

  if (deviceId) {
    const { data: device } = await supabase
      .from("device_status")
      .select("id")
      .eq("user_id", user.id)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (!device && (activePanic || activeMonitor || alertaId)) {
      return jsonResponse({ success: false, error: "NO_DEVICE_REGISTERED" }, 403);
    }

    if (activePanic && activePanic.device_id && activePanic.device_id !== deviceId) {
      return jsonResponse({ success: false, error: "DEVICE_MISMATCH" }, 403);
    }
  }

  let finalAlertaId: string | null = alertaId || null;
  if (!finalAlertaId && activePanic) {
    finalAlertaId = activePanic.id;
  }

  await supabase.from("localizacoes").insert({
    user_id: user.id,
    device_id: deviceId || null,
    alerta_id: finalAlertaId,
    latitude,
    longitude,
    precisao_metros: body.precisao_metros != null ? Number(body.precisao_metros) : null,
    bateria_percentual: body.bateria_percentual != null ? Number(body.bateria_percentual) : null,
    speed: body.speed != null ? Number(body.speed) : null,
    heading: body.heading != null ? Number(body.heading) : null,
    timestamp_gps: body.timestamp_gps as string || null,
  });

  return jsonResponse({
    success: true,
    message: "Localização registrada",
    alerta_id: finalAlertaId,
    servidor_timestamp: new Date().toISOString(),
  });
}

async function handleAcionarPanico(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();
  if (!emailUsuario) return errorResponse("email_usuario obrigatório", 400);

  const { data: user } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", emailUsuario)
    .maybeSingle();

  if (!user) return errorResponse("Usuário não encontrado", 404);

  const protocolo = generateProtocolo();
  const tipoAcionamento = (body.tipo_acionamento as string) || "botao_panico";
  // Accept coordinates from body.latitude/longitude OR body.localizacao.latitude/longitude
  const loc = body.localizacao as Record<string, unknown> | undefined;
  const latitude = (body.latitude ?? loc?.latitude) as number | undefined;
  const longitude = (body.longitude ?? loc?.longitude) as number | undefined;

  const { data: alerta } = await supabase
    .from("alertas_panico")
    .insert({
      user_id: user.id,
      device_id: body.device_id as string || null,
      status: "ativo",
      protocolo,
      tipo_acionamento: tipoAcionamento,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    })
    .select("id")
    .single();

  if (!alerta) return errorResponse("Erro ao criar alerta", 500);

  if (latitude !== undefined && longitude !== undefined) {
    await supabase.from("localizacoes").insert({
      user_id: user.id,
      device_id: body.device_id as string || null,
      alerta_id: alerta.id,
      latitude,
      longitude,
    });
  }

  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action_type: "panico_acionado",
    success: true,
    ip_address: ip,
    details: { protocolo, tipo_acionamento: tipoAcionamento, alerta_id: alerta.id },
  });

  // Fire-and-forget: notify guardians via WhatsApp (conditional on config)
  fireWhatsApp(user.id, "panico", latitude, longitude, alerta.id);

  // Fire-and-forget: automatic COPOM emergency call via voice agent
  fireCopomCall(user.id, alerta.id);

  return jsonResponse({
    success: true,
    alerta_id: alerta.id,
    protocolo,
    rede_apoio_notificada: true,
    autoridades_acionadas: true,
  });
}

async function handleCancelarPanico(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();
  if (!emailUsuario) return errorResponse("email_usuario obrigatório", 400);

  const { data: user } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", emailUsuario)
    .maybeSingle();

  if (!user) return errorResponse("Usuário não encontrado", 404);

  // Find active alert
  const { data: alerta } = await supabase
    .from("alertas_panico")
    .select("id, protocolo, criado_em, window_id")
    .eq("user_id", user.id)
    .eq("status", "ativo")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!alerta) return errorResponse("Nenhum alerta ativo encontrado", 404);

  const tipoCancelamento = (body.tipo_cancelamento as string) || "manual";
  const motivoCancelamento = body.motivo_cancelamento as string || null;
  const now = new Date();
  const criadoEm = new Date(alerta.criado_em);
  const tempoAte = Math.round((now.getTime() - criadoEm.getTime()) / 1000);
  const canceladoDentroJanela = tempoAte <= 60;

  const guardioeNotificados = tipoCancelamento === "manual";
  const autoridadesAcionadas = !canceladoDentroJanela;

  const windowId = alerta.window_id || null;
  const windowSelada = true;

  // Update alert
  await supabase
    .from("alertas_panico")
    .update({
      status: "cancelado",
      cancelado_em: now.toISOString(),
      motivo_cancelamento: motivoCancelamento,
      tipo_cancelamento: tipoCancelamento,
      cancelado_dentro_janela: canceladoDentroJanela,
      tempo_ate_cancelamento_segundos: tempoAte,
      autoridades_acionadas: autoridadesAcionadas,
      guardioes_notificados: guardioeNotificados,
      window_selada: windowSelada,
    })
    .eq("id", alerta.id);

  // AUTO-SEAL any active monitoring session for this user
  const { data: activeSession } = await supabase
    .from("monitoramento_sessoes")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "ativa")
    .maybeSingle();

  if (activeSession) {
    await supabase
      .from("monitoramento_sessoes")
      .update({
        status: "aguardando_finalizacao",
        closed_at: now.toISOString(),
        sealed_reason: "panico_cancelado",
        origem: "botao_panico",
      })
      .eq("id", activeSession.id);

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "session_sealed",
      success: true,
      ip_address: ip,
      details: { session_id: activeSession.id, sealed_reason: "panico_cancelado" },
    });
  }

  // Audit
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action_type: "panico_cancelado",
    success: true,
    ip_address: ip,
    details: {
      alerta_id: alerta.id,
      tipo_cancelamento: tipoCancelamento,
      cancelado_dentro_janela: canceladoDentroJanela,
    },
  });

  // Deactivate GPS sharing linked to this alert
  await supabase
    .from("compartilhamento_gps")
    .update({ ativo: false })
    .eq("user_id", user.id)
    .eq("alerta_id", alerta.id);

  // Fire-and-forget: notify guardians that panic was resolved
  fireWhatsAppResolved(user.id);

  return jsonResponse({
    success: true,
    message: "Alerta cancelado com sucesso",
    alerta_id: alerta.id,
    protocolo: alerta.protocolo,
    tipo_cancelamento: tipoCancelamento,
    cancelado_dentro_janela: canceladoDentroJanela,
    tempo_ate_cancelamento_segundos: tempoAte,
    autoridades_acionadas: autoridadesAcionadas,
    guardioes_notificados: guardioeNotificados,
    window_selada: windowSelada,
    window_id: windowId,
  });
}

// ── Fase 4 Handlers ──

async function handleReceberAudio(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  // Support both session_token and email_usuario for auth
  const sessionToken = body.session_token as string | undefined;
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();

  let user: { id: string } | null = null;

  if (sessionToken) {
    const result = await validateSession(supabase, sessionToken);
    if (result.error || !result.user) return errorResponse(result.error || "Sessão inválida", 401);
    user = { id: (result.user as Record<string, unknown>).id as string };
  } else if (emailUsuario) {
    const found = await findUserByEmail(supabase, emailUsuario);
    if (!found) return errorResponse("Usuário não encontrado", 404);
    user = { id: found.id as string };
  } else {
    return errorResponse("session_token ou email_usuario obrigatório", 400);
  }

  // Handle audio file from multipart upload
  const audioFileData = body._audioFile as { data: Uint8Array; name: string; type: string } | undefined;

  let fileUrl = body.file_url as string | undefined;
  const deviceId = body.device_id as string || null;
  const duracaoSegundos = body.duracao_segundos as number || null;
  const tamanhoMb = body.tamanho_mb as number || null;
  const segmentoIdx = body.segmento_idx as number | undefined;
  const timezone = body.timezone as string || null;
  const tzOffset = body.timezone_offset_minutes as number | undefined;

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const fileId = crypto.randomUUID();
  const ext = audioFileData?.name?.split(".").pop() || "mp4";
  const storagePath = `${user.id}/${dateStr}/${fileId}.${ext}`;

  // Upload binary to R2 if multipart file was provided
  if (audioFileData) {
    try {
      const r2 = getR2Client();
      const url = r2Url(storagePath);
      const uploadResp = await r2.fetch(url, {
        method: "PUT",
        body: audioFileData.data,
        headers: { "content-type": audioFileData.type },
      });
      if (!uploadResp.ok) {
        const errText = await uploadResp.text();
        console.error("R2 upload error:", uploadResp.status, errText);
        return errorResponse("Erro ao enviar arquivo de áudio para storage", 500);
      }
      const publicUrl = R2_PUBLIC_URL();
      fileUrl = publicUrl ? `${publicUrl}/${storagePath}` : storagePath;
      console.log(`Audio uploaded to R2: ${storagePath} (${(audioFileData.data.length / 1024 / 1024).toFixed(2)} MB)`);
    } catch (e) {
      console.error("R2 upload error:", e);
      return errorResponse("Erro ao enviar arquivo de áudio para storage", 500);
    }
  }

  if (!fileUrl) return errorResponse("file_url ou arquivo de áudio obrigatório", 400);

  // Check active monitoring session (bifurcated flow)
  let sessionQuery = supabase
    .from("monitoramento_sessoes")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "ativa");

  if (deviceId) {
    sessionQuery = sessionQuery.eq("device_id", deviceId);
  }

  const { data: activeSession } = await sessionQuery.maybeSingle();

  if (!activeSession) {
    // No active session — app must send iniciarGravacao first
    return errorResponse("Nenhuma sessão de monitoramento ativa. Envie iniciarGravacao antes dos segmentos.", 400);
  }

  // ── SEGMENT PATH: monitoring session active ──

  // Idempotency check
  if (segmentoIdx !== undefined && segmentoIdx !== null) {
    const { data: existingSegment } = await supabase
      .from("gravacoes_segmentos")
      .select("id")
      .eq("monitor_session_id", activeSession.id)
      .eq("segmento_idx", segmentoIdx)
      .maybeSingle();

    if (existingSegment) {
      return jsonResponse({
        success: true,
        segmento_id: existingSegment.id,
        monitor_session_id: activeSession.id,
        storage_path: storagePath,
        message: "Segmento de monitoramento salvo. Será processado na concatenação final.",
      });
    }
  }

  const { data: segmento } = await supabase
    .from("gravacoes_segmentos")
    .insert({
      user_id: user.id,
      monitor_session_id: activeSession.id,
      device_id: deviceId,
      file_url: fileUrl,
      storage_path: storagePath,
      segmento_idx: segmentoIdx ?? null,
      duracao_segundos: duracaoSegundos,
      tamanho_mb: tamanhoMb,
      timezone,
      timezone_offset_minutes: tzOffset ?? null,
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // Audit
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action_type: "segment_received",
    success: true,
    ip_address: ip,
    details: { session_id: activeSession.id, segmento_idx: segmentoIdx ?? null },
  });

  return jsonResponse({
    success: true,
    segmento_id: segmento?.id,
    monitor_session_id: activeSession.id,
    storage_path: storagePath,
    message: "Segmento de monitoramento salvo. Será processado na concatenação final.",
  });
}

async function handleGetAudioSignedUrl(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  // Doc: accepts file_path + (session_token OR email_usuario)
  const filePath = body.file_path as string;
  const sessionToken = body.session_token as string | undefined;
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();
  // Also support legacy gravacao_id
  const gravacaoId = body.gravacao_id as string | undefined;

  // Resolve user
  let userId: string | null = null;

  if (sessionToken) {
    const { user, error } = await validateSession(supabase, sessionToken);
    if (error || !user) return errorResponse(error || "Sessão inválida", 401);
    userId = (user as Record<string, unknown>).id as string;
  } else if (emailUsuario) {
    const user = await findUserByEmail(supabase, emailUsuario);
    if (!user) return errorResponse("Usuário não encontrado", 404);
    userId = user.id as string;
  } else {
    return errorResponse("session_token ou email_usuario obrigatório", 400);
  }

  let storagePath: string | null = null;
  let responseGravacaoId: string | null = null;

  if (filePath) {
    // Doc standard: file_path (storage path)
    storagePath = filePath;

    // Verify ownership via gravacoes or gravacoes_segmentos
    const { data: rec } = await supabase
      .from("gravacoes")
      .select("id")
      .eq("user_id", userId)
      .eq("storage_path", filePath)
      .maybeSingle();

    if (!rec) {
      const { data: seg } = await supabase
        .from("gravacoes_segmentos")
        .select("id")
        .eq("user_id", userId)
        .eq("storage_path", filePath)
        .maybeSingle();
      if (!seg) return errorResponse("Arquivo não encontrado ou sem permissão", 404);
    } else {
      responseGravacaoId = rec.id;
    }
  } else if (gravacaoId) {
    // Legacy: gravacao_id
    const { data: gravacao } = await supabase
      .from("gravacoes")
      .select("id, storage_path")
      .eq("id", gravacaoId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!gravacao) return errorResponse("Gravação não encontrada", 404);
    if (!gravacao.storage_path) return errorResponse("Arquivo de áudio não disponível", 404);
    storagePath = gravacao.storage_path;
    responseGravacaoId = gravacao.id;
  } else {
    return errorResponse("file_path ou gravacao_id obrigatório", 400);
  }

  // URL expires in 15 minutes (900s) per doc
  const { data: signedUrl } = await supabase.storage
    .from("audio-recordings")
    .createSignedUrl(storagePath!, 900);

  return jsonResponse({
    success: true,
    signed_url: signedUrl?.signedUrl || null,
    gravacao_id: responseGravacaoId,
    expires_in_seconds: 900,
  });
}

async function handleReprocessarGravacao(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  // Doc: no auth required, just gravacao_id
  const gravacaoId = body.gravacao_id as string;
  if (!gravacaoId) return errorResponse("gravacao_id obrigatório", 400);

  const { data: gravacao } = await supabase
    .from("gravacoes")
    .select("id, user_id, status")
    .eq("id", gravacaoId)
    .maybeSingle();

  if (!gravacao) return errorResponse("Gravação não encontrada", 404);

  await supabase
    .from("gravacoes")
    .update({ status: "pendente", processado_em: null, erro_processamento: null, transcricao: null })
    .eq("id", gravacao.id);

  await supabase.from("audit_logs").insert({
    user_id: gravacao.user_id,
    action_type: "reprocessar_gravacao",
    success: true,
    ip_address: ip,
    details: { gravacao_id: gravacao.id },
  });

  return jsonResponse({
    success: true,
    gravacao_id: gravacao.id,
    message: "Gravação enviada para reprocessamento",
    status: "pendente",
  });
}

// reprocess_recording: authenticated version
async function handleReprocessRecording(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  const sessionToken = body.session_token as string;
  const { user, error } = await validateSession(supabase, sessionToken);
  if (error || !user) return errorResponse(error || "Sessão inválida", 401);

  const gravacaoId = body.gravacao_id as string;
  if (!gravacaoId) return errorResponse("gravacao_id obrigatório", 400);

  const userId = (user as Record<string, unknown>).id as string;

  const { data: gravacao } = await supabase
    .from("gravacoes")
    .select("id, status")
    .eq("id", gravacaoId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!gravacao) return errorResponse("Gravação não encontrada", 404);

  await supabase
    .from("gravacoes")
    .update({ status: "pendente", processado_em: null, erro_processamento: null, transcricao: null })
    .eq("id", gravacao.id);

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action_type: "reprocessar_gravacao",
    success: true,
    ip_address: ip,
    details: { gravacao_id: gravacao.id },
  });

  return jsonResponse({
    success: true,
    gravacao_id: gravacao.id,
    message: "Reprocessamento iniciado",
    status: "pendente",
  });
}

async function handleReportarStatusMonitoramento(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  // Doc: uses email_usuario, device_id, status_monitoramento, motivo, app_state, next_check_at
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();
  if (!emailUsuario) return errorResponse("email_usuario obrigatório", 400);

  const deviceId = body.device_id as string;
  if (!deviceId) return errorResponse("device_id obrigatório", 400);

  const statusMonitoramento = body.status_monitoramento as string;
  if (!statusMonitoramento) return errorResponse("status_monitoramento obrigatório", 400);

  const validStatuses = ["janela_iniciada", "janela_finalizada", "ativado", "desativado", "erro", "retomado"];
  if (!validStatuses.includes(statusMonitoramento)) {
    return errorResponse(`status_monitoramento inválido. Valores aceitos: ${validStatuses.join(", ")}`, 400);
  }

  const user = await findUserByEmail(supabase, emailUsuario);
  if (!user) return errorResponse("Usuário não encontrado", 404);
  const userId = user.id as string;

  const motivo = body.motivo as string | undefined;
  const appState = body.app_state as string | undefined;

  // Map status to monitoring session updates
  const isActive = ["janela_iniciada", "ativado", "retomado"].includes(statusMonitoramento);
  const isFinalizing = ["janela_finalizada", "desativado", "erro"].includes(statusMonitoramento);

  // Update device_status
  await supabase
    .from("device_status")
    .update({ is_monitoring: isActive })
    .eq("user_id", userId)
    .eq("device_id", deviceId);

  // If finalizing, seal active session
  if (isFinalizing) {
    const { data: activeSession } = await supabase
      .from("monitoramento_sessoes")
      .select("id")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .eq("status", "ativa")
      .maybeSingle();

    if (activeSession) {
      const now = new Date().toISOString();
      await supabase
        .from("monitoramento_sessoes")
        .update({
          status: "aguardando_finalizacao",
          closed_at: now,
          finalizado_em: now,
          sealed_reason: motivo || statusMonitoramento,
        })
        .eq("id", activeSession.id);
    }
  }

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action_type: "reportar_status_monitoramento",
    success: true,
    ip_address: ip,
    details: { status_monitoramento: statusMonitoramento, motivo, app_state: appState, device_id: deviceId },
  });

  return jsonResponse({
    success: true,
    message: "Status de monitoramento atualizado",
    servidor_timestamp: new Date().toISOString(),
  });
}

async function handleReportarStatusGravacao(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  ip: string
): Promise<Response> {
  // Doc: uses email_usuario for auth
  const emailUsuario = (body.email_usuario as string)?.trim().toLowerCase();
  if (!emailUsuario) return errorResponse("email_usuario obrigatório", 400);

  const user = await findUserByEmail(supabase, emailUsuario);
  if (!user) return errorResponse("Usuário não encontrado", 404);
  const userId = user.id as string;

  const deviceId = body.device_id as string || null;
  const statusGravacao = body.status_gravacao as string;
  const origemGravacao = body.origem_gravacao as string | undefined;
  const motivoParada = body.motivo_parada as string | undefined;
  const totalSegmentos = body.total_segmentos as number | undefined;

  if (!statusGravacao) return errorResponse("status_gravacao obrigatório", 400);

  const validStatuses = ["iniciada", "pausada", "retomada", "finalizada", "enviando", "erro"];
  if (!validStatuses.includes(statusGravacao)) {
    return errorResponse(`status_gravacao inválido. Valores aceitos: ${validStatuses.join(", ")}`, 400);
  }

  const validOrigens = ["automatico", "botao_panico", "agendado", "comando_voz", "botao_manual"];

  // ── Session creation flow (iniciarGravacao) ──
  if (statusGravacao === "iniciada" && deviceId) {
    // Check if there's already an active session for this device
    const { data: existingSession } = await supabase
      .from("monitoramento_sessoes")
      .select("id")
      .eq("user_id", userId)
      .eq("device_id", deviceId)
      .eq("status", "ativa")
      .maybeSingle();

    if (!existingSession) {
      const { data: newSession } = await supabase
        .from("monitoramento_sessoes")
        .insert({
          user_id: userId,
          device_id: deviceId,
          status: "ativa",
          origem: origemGravacao && validOrigens.includes(origemGravacao) ? origemGravacao : "manual",
        })
        .select("id")
        .single();

      console.log(`Created monitoring session ${newSession?.id} for device ${deviceId}, origem: ${origemGravacao}`);

      // Set is_recording on the user's current device (any device_id)
      await supabase
        .from("device_status")
        .update({ is_recording: true })
        .eq("user_id", userId);

      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "session_created",
        success: true,
        ip_address: ip,
        details: { session_id: newSession?.id, origem: origemGravacao, device_id: deviceId },
      });

      return jsonResponse({
        success: true,
        message: "Sessão de gravação iniciada",
        sessao_id: newSession?.id,
        origem_gravacao: origemGravacao,
        servidor_timestamp: new Date().toISOString(),
      });
    }

    // Session already exists, just acknowledge
    return jsonResponse({
      success: true,
      message: "Sessão de gravação já ativa",
      sessao_id: existingSession.id,
      servidor_timestamp: new Date().toISOString(),
    });
  }

  // ── Session sealing flow ──
  // Only seal immediately for specific motivos; otherwise just update device flags
  const MOTIVOS_SEAL_IMEDIATO = ["botao_manual", "manual", "parada_panico"];

  if (statusGravacao === "finalizada") {
    let sessionQuery = supabase
      .from("monitoramento_sessoes")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "ativa");

    if (deviceId) {
      sessionQuery = sessionQuery.eq("device_id", deviceId);
    }

    const { data: activeSession } = await sessionQuery.maybeSingle();

    if (activeSession) {
      const shouldSealNow = MOTIVOS_SEAL_IMEDIATO.includes(motivoParada ?? "");

      // Update device status — only reset is_recording; is_monitoring stays true
      // until the monitoring window expires via session-maintenance
      await supabase
        .from("device_status")
        .update({ is_recording: false })
        .eq("user_id", userId);

      if (!shouldSealNow) {
        // Not an immediate seal motivo — just log and acknowledge
        await supabase.from("audit_logs").insert({
          user_id: userId,
          action_type: "recording_finalized_no_seal",
          success: true,
          ip_address: ip,
          details: { session_id: activeSession.id, motivo_parada: motivoParada, origem: origemGravacao, total_segmentos: totalSegmentos },
        });

        return jsonResponse({
          success: true,
          message: "Gravação finalizada, sessão permanece ativa",
          sessao_id: activeSession.id,
          status: "ativa",
          total_segmentos: totalSegmentos ?? null,
          motivo_parada: motivoParada ?? null,
          servidor_timestamp: new Date().toISOString(),
        });
      }

      // ── Immediate seal: botao_manual or parada_panico ──

      // If total_segments is 0, recording was too short (<15s) — discard entirely
      if (totalSegmentos === 0) {
        // Delete any orphan segments from R2 (safety)
        const { data: orphanSegs } = await supabase
          .from("gravacoes_segmentos")
          .select("id, storage_path, file_url")
          .eq("monitor_session_id", activeSession.id);

        if (orphanSegs && orphanSegs.length > 0) {
          const r2 = getR2Client();
          for (const seg of orphanSegs) {
            const segPath = seg.storage_path || seg.file_url;
            if (segPath) {
              try {
                const delRes = await r2.fetch(r2Url(segPath), { method: "DELETE" });
                await delRes.body?.cancel();
              } catch { /* ignore */ }
            }
            await supabase.from("gravacoes_segmentos").delete().eq("id", seg.id);
          }
        }

        // Delete the session record
        await supabase
          .from("monitoramento_sessoes")
          .delete()
          .eq("id", activeSession.id);

        console.log(`Discarded short session ${activeSession.id} (0 segments)`);

        await supabase.from("audit_logs").insert({
          user_id: userId,
          action_type: "session_discarded_short",
          success: true,
          ip_address: ip,
          details: { session_id: activeSession.id, reason: "zero_segments", motivo_parada: motivoParada },
        });

        return jsonResponse({
          success: true,
          message: "Gravação muito curta, descartada",
          sessao_id: activeSession.id,
          status: "descartada",
          total_segmentos: 0,
          motivo_parada: motivoParada ?? null,
          servidor_timestamp: new Date().toISOString(),
        });
      }

      // Normal sealing flow (has segments)
      const now = new Date().toISOString();
      await supabase
        .from("monitoramento_sessoes")
        .update({
          status: "aguardando_finalizacao",
          closed_at: now,
          sealed_reason: motivoParada || "manual",
          finalizado_em: now,
        })
        .eq("id", activeSession.id);

      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "session_sealed",
        success: true,
        ip_address: ip,
        details: { session_id: activeSession.id, sealed_reason: motivoParada || "manual", origem: origemGravacao, total_segmentos: totalSegmentos },
      });

      return jsonResponse({
        success: true,
        message: "Status da gravação atualizado",
        sessao_id: activeSession.id,
        status: "aguardando_finalizacao",
        total_segmentos: totalSegmentos ?? null,
        motivo_parada: motivoParada ?? null,
        servidor_timestamp: new Date().toISOString(),
      });
    }

    // No active session found but fields present — just acknowledge
    return jsonResponse({
      success: true,
      message: "Status da gravação atualizado",
      total_segmentos: totalSegmentos ?? null,
      motivo_parada: motivoParada ?? null,
      servidor_timestamp: new Date().toISOString(),
    });
  }

  // ── Status update for device ──
  if (deviceId) {
    const isRecording = ["iniciada", "retomada", "enviando"].includes(statusGravacao);
    await supabase
      .from("device_status")
      .update({ is_recording: isRecording })
      .eq("user_id", userId)
      .eq("device_id", deviceId);
  }

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action_type: "reportar_status_gravacao",
    success: true,
    ip_address: ip,
    details: { status_gravacao: statusGravacao, origem_gravacao: origemGravacao, motivo_parada: motivoParada, device_id: deviceId },
  });

  return jsonResponse({
    success: true,
    message: "Status da gravação atualizado",
    total_segmentos: totalSegmentos ?? null,
    motivo_parada: motivoParada ?? null,
    servidor_timestamp: new Date().toISOString(),
  });
}

// ── Test: Create tracking link (no auth) ──
async function handleCreateTestTrackingLink(body: Record<string, unknown>, supabase: any) {
  const userId = body.user_id as string;
  const codigo = body.codigo as string;
  if (!userId || !codigo) {
    return errorResponse("user_id e codigo são obrigatórios", 400);
  }

  // Deactivate existing test links with same code
  await supabase
    .from("compartilhamento_gps")
    .update({ ativo: false })
    .eq("codigo", codigo)
    .eq("tipo", "teste");

  // Create new test tracking link (24h expiry)
  const { data: link, error } = await supabase
    .from("compartilhamento_gps")
    .insert({
      user_id: userId,
      codigo,
      tipo: "teste",
      ativo: true,
      expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id, codigo")
    .single();

  if (error) {
    console.error("createTestTrackingLink error:", error);
    return errorResponse("Erro ao criar link de teste: " + error.message, 500);
  }

  return jsonResponse({ success: true, link });
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

    let body: Record<string, unknown>;
    let audioFile: { data: Uint8Array; name: string; type: string } | null = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // ── Multipart: extract text fields + audio file ──
      const formData = await req.formData();
      body = {};
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          audioFile = {
            data: new Uint8Array(await value.arrayBuffer()),
            name: value.name,
            type: value.type || "audio/mp4",
          };
        } else {
          // Try to parse numeric values
          const num = Number(value);
          body[key] = value === "true" ? true : value === "false" ? false : !isNaN(num) && value !== "" ? num : value;
        }
      }
    } else {
      // ── JSON body ──
      const reqClone = req.clone();
      try {
        body = await req.json();
      } catch (_parseErr) {
        const rawBody = await reqClone.text().catch(() => "<unreadable>");
        console.error("JSON parse error. Raw body (first 200 chars):", rawBody.substring(0, 200));
        return errorResponse("JSON inválido no body da requisição", 400);
      }
    }

    // Attach audio file to body for handlers that need it
    if (audioFile) {
      body._audioFile = audioFile;
    }

    const action = body.action as string;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    if (!action) {
      return errorResponse("Campo 'action' é obrigatório", 400);
    }

    switch (action) {
      // ── Fase 1 ──
      case "loginCustomizado":
        return await handleLogin(body, supabase, ip);
      case "refresh_token":
        return await handleRefreshToken(body, supabase, ip);
      case "pingMobile":
        return await handlePing(body, supabase);
      case "syncConfigMobile":
        return await handleSyncConfig(body, supabase);

      // ── Fase 2 ──
      case "logoutMobile":
        return await handleLogout(body, supabase, ip);
      case "validate_password":
        return await handleValidatePassword(body, supabase, ip);
      case "change_password":
        return await handleChangePassword(body, supabase, ip);
      case "change_coercion_password":
        return await handleChangeCoercionPassword(body, supabase, ip);
      case "update_schedules":
        return await handleUpdateSchedules(body, supabase, ip);

      // ── Fase 3 ──
      case "enviarLocalizacaoGPS":
        return await handleEnviarLocalizacaoGPS(body, supabase);
      case "acionarPanicoMobile":
        return await handleAcionarPanico(body, supabase, ip);
      case "cancelarPanicoMobile":
        return await handleCancelarPanico(body, supabase, ip);

      // ── Fase 4 ──
      case "receberAudioMobile":
        return await handleReceberAudio(body, supabase, ip);
      case "getAudioSignedUrl":
        return await handleGetAudioSignedUrl(body, supabase);
      case "reprocessarGravacao":
        return await handleReprocessarGravacao(body, supabase, ip);
      case "reprocess_recording":
        return await handleReprocessRecording(body, supabase, ip);
      case "reportarStatusMonitoramento":
        return await handleReportarStatusMonitoramento(body, supabase, ip);
      case "reportarStatusGravacao":
      case "iniciarGravacao":
      case "pararGravacao":
      case "finalizarGravacao":
        return await handleReportarStatusGravacao(body, supabase, ip);

      // ── Test utilities (no auth required) ──
      case "createTestTrackingLink":
        return await handleCreateTestTrackingLink(body, supabase);

      default:
        return errorResponse("Action desconhecida", 400);
    }
  } catch (err) {
    console.error("mobile-api error:", err);
    return errorResponse("Erro interno do servidor", 500);
  }
});
