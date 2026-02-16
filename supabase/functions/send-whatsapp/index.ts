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

// ── Phone formatting ──

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

// ── Haversine distance (meters) ──

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Reverse geocode via Nominatim ──

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=pt-BR`,
      {
        headers: { "User-Agent": "AmparaMulher/1.0" },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    const data = await res.json();
    const a = data.address || {};
    const road = a.road || a.pedestrian || a.suburb || "";
    const suburb = a.suburb || a.neighbourhood || "";
    const city = a.city || a.town || a.village || "";
    const state = a.state || "";
    const parts = [road, suburb, city, state].filter(Boolean);
    return parts.join(", ") || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}

// ── Send WhatsApp template message ──

interface NamedParam { name: string; value: string }

async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  namedParams: NamedParam[]
): Promise<{ ok: boolean; error?: string }> {
  const token = Deno.env.get("META_WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("META_WHATSAPP_PHONE_ID");
  if (!token || !phoneId) {
    return { ok: false, error: "WhatsApp credentials not configured" };
  }

  const formattedPhone = formatPhone(phone);

  const body = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: namedParams.map((p) => ({
            type: "text",
            parameter_name: p.name,
            text: p.value,
          })),
        },
      ],
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error(`WhatsApp API error [${res.status}]:`, err);
      return { ok: false, error: `API ${res.status}: ${err}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("WhatsApp send error:", e);
    return { ok: false, error: e.message };
  }
}

// ── Config check helpers ──

interface AcionamentosConfig {
  whatsapp_guardioes?: { grave?: boolean; critico?: boolean };
  autoridades_190_180?: { critico?: boolean };
  senha_coacao?: { notificar_guardioes?: boolean };
}

function getAcionamentos(configAlerts: any): AcionamentosConfig {
  return (configAlerts?.acionamentos || {}) as AcionamentosConfig;
}

function isAlertEnabled(acionamentos: AcionamentosConfig, tipo: string): boolean {
  switch (tipo) {
    case "panico":
    case "critico":
      return acionamentos.whatsapp_guardioes?.critico !== false; // default true
    case "alto":
      return acionamentos.whatsapp_guardioes?.grave !== false; // default true
    case "coacao":
      return acionamentos.senha_coacao?.notificar_guardioes !== false; // default true
    default:
      return false;
  }
}

// ── High-level notification functions ──

async function notifyGuardiansAlert(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tipo: string, // "panico" | "alto" | "critico" | "coacao"
  lat?: number | null,
  lon?: number | null,
  alertaId?: string | null,
  skipCooldown?: boolean
): Promise<{ sent: number; skipped: boolean; cooldown?: boolean; minutes_remaining?: number }> {
  // 0. Cooldown de 60 minutos
  if (userId && !skipCooldown) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentAlerts } = await supabase
      .from("audit_logs")
      .select("id, created_at")
      .eq("action_type", "whatsapp_alert_sent")
      .eq("user_id", userId)
      .eq("success", true)
      .gte("created_at", oneHourAgo)
      .limit(1);

    if (recentAlerts && recentAlerts.length > 0) {
      const lastAt = new Date(recentAlerts[0].created_at);
      const minutesRemaining = Math.ceil((60 * 60 * 1000 - (Date.now() - lastAt.getTime())) / 60000);
      console.log(`WhatsApp cooldown active for user ${userId}. ${minutesRemaining}min remaining.`);
      return { sent: 0, skipped: true, cooldown: true, minutes_remaining: minutesRemaining };
    }
  }

  // 1. Fetch user data
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nome_completo, gps_duracao_minutos, configuracao_alertas, endereco_lat, endereco_lon, compartilhar_gps_panico, compartilhar_gps_risco_alto")
    .eq("id", userId)
    .single();

  if (!usuario) {
    console.error("notifyGuardiansAlert: user not found", userId);
    return { sent: 0, skipped: true };
  }

  // 2. Check config
  const acionamentos = getAcionamentos(usuario.configuracao_alertas);
  if (!isAlertEnabled(acionamentos, tipo)) {
    console.log(`WhatsApp alert skipped: tipo=${tipo} disabled in config for user ${userId}`);
    return { sent: 0, skipped: true };
  }

  // 3. Fetch guardians
  const { data: guardioes } = await supabase
    .from("guardioes")
    .select("id, nome, telefone_whatsapp")
    .eq("usuario_id", userId);

  if (!guardioes || guardioes.length === 0) {
    console.log("No guardians found for user", userId);
    return { sent: 0, skipped: false };
  }

  // 4. Fetch aggressor
  const { data: vinculo } = await supabase
    .from("vitimas_agressores")
    .select("agressor_id, tipo_vinculo, agressores(nome)")
    .eq("usuario_id", userId)
    .eq("status_relacao", "ativo")
    .limit(1)
    .maybeSingle();

  const nomeAgressor = (vinculo as any)?.agressores?.nome || "Não informado";
  const tipoVinculo = (vinculo as any)?.tipo_vinculo || "";
  const agressorParam = tipoVinculo ? `${tipoVinculo} ${nomeAgressor}` : nomeAgressor;

  // 5. Resolve location
  let endereco = "Localização não disponível";
  let shareLink = "";

  // Get lat/lon from params or last known location
  let finalLat = lat;
  let finalLon = lon;
  if (finalLat == null || finalLon == null) {
    const { data: lastLoc } = await supabase
      .from("localizacoes")
      .select("latitude, longitude")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastLoc) {
      finalLat = lastLoc.latitude;
      finalLon = lastLoc.longitude;
    }
  }

  if (finalLat != null && finalLon != null) {
    // Check proximity to registered address
    if (usuario.endereco_lat != null && usuario.endereco_lon != null) {
      const dist = haversineMeters(finalLat, finalLon, usuario.endereco_lat, usuario.endereco_lon);
      if (dist <= 50) {
        endereco = "Em casa";
      } else {
        endereco = await reverseGeocode(finalLat, finalLon);
      }
    } else {
      endereco = await reverseGeocode(finalLat, finalLon);
    }

    // Create GPS share link if applicable
    const shouldShare =
      (tipo === "panico" || tipo === "critico") ? usuario.compartilhar_gps_panico :
      (tipo === "alto") ? usuario.compartilhar_gps_risco_alto : true;

    if (shouldShare) {
      // Generate 5-char alphanumeric code
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let codigo = "";
      const rnd = new Uint8Array(5);
      crypto.getRandomValues(rnd);
      for (let i = 0; i < 5; i++) codigo += chars[rnd[i] % chars.length];

      const duracaoMin = usuario.gps_duracao_minutos || 30;
      const expiraEm = new Date(Date.now() + duracaoMin * 60 * 1000).toISOString();

      await supabase.from("compartilhamento_gps").insert({
        user_id: userId,
        codigo,
        tipo: tipo === "panico" ? "panico" : "alerta",
        alerta_id: alertaId || null,
        expira_em: expiraEm,
        ativo: true,
      });

      shareLink = `https://amparamulher.com.br/${codigo}`;
    }
  }

  const minutos = String(usuario.gps_duracao_minutos || 30);

  // 6. Send to each guardian
  let sentCount = 0;
  const results = await Promise.allSettled(
    guardioes.map(async (g) => {
      const params: NamedParam[] = [
        { name: "vitima", value: usuario.nome_completo },
        { name: "nome_do_agressor", value: agressorParam },
        { name: "min", value: minutos },
        { name: "localizacao", value: shareLink || "Indisponível" },
        { name: "endereco", value: endereco },
      ];
      console.log("WhatsApp params:", JSON.stringify(params), "phone:", g.telefone_whatsapp);
      const result = await sendWhatsAppTemplate(g.telefone_whatsapp, "ampara2", params);

      // Log
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "whatsapp_alert_sent",
        success: result.ok,
        details: {
          tipo,
          guardian_id: g.id,
          guardian_name: g.nome,
          template: "ampara2",
          error: result.error || null,
        },
      });

      if (result.ok) sentCount++;
      return result;
    })
  );

  console.log(`WhatsApp alerts sent: ${sentCount}/${guardioes.length} for tipo=${tipo}`);
  return { sent: sentCount, skipped: false };
}

async function notifyGuardiansResolved(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ sent: number }> {
  // Fetch user name
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nome_completo")
    .eq("id", userId)
    .single();

  if (!usuario) return { sent: 0 };

  // Fetch guardians
  const { data: guardioes } = await supabase
    .from("guardioes")
    .select("id, nome, telefone_whatsapp")
    .eq("usuario_id", userId);

  if (!guardioes || guardioes.length === 0) return { sent: 0 };

  let sentCount = 0;
  await Promise.allSettled(
    guardioes.map(async (g) => {
      const params: NamedParam[] = [
        { name: "guardiao", value: g.nome },
        { name: "vitima", value: usuario.nome_completo },
      ];
      console.log("WhatsApp resolved params:", JSON.stringify(params), "phone:", g.telefone_whatsapp);
      const result = await sendWhatsAppTemplate(g.telefone_whatsapp, "amparasafe", params);

      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "whatsapp_resolved_sent",
        success: result.ok,
        details: {
          guardian_id: g.id,
          guardian_name: g.nome,
          template: "amparasafe",
          error: result.error || null,
        },
      });

      if (result.ok) sentCount++;
    })
  );

  console.log(`WhatsApp resolved sent: ${sentCount}/${guardioes.length}`);
  return { sent: sentCount };
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, user_id, tipo, lat, lon, alerta_id, skip_cooldown } = await req.json();

    if (!action) return json({ error: "action obrigatória" }, 400);
    if (!user_id) return json({ error: "user_id obrigatório" }, 400);

    if (action === "notify_alert") {
      if (!tipo) return json({ error: "tipo obrigatório" }, 400);
      const result = await notifyGuardiansAlert(supabase, user_id, tipo, lat, lon, alerta_id, skip_cooldown === true);
      if (result.cooldown) {
        return json({ error: "cooldown_active", message: `Notificação WhatsApp bloqueada. Aguarde ${result.minutes_remaining} minuto(s).`, ...result }, 429);
      }
      return json({ success: true, ...result });
    }

    if (action === "notify_resolved") {
      const result = await notifyGuardiansResolved(supabase, user_id);
      return json({ success: true, ...result });
    }

    return json({ error: `Action desconhecida: ${action}` }, 400);
  } catch (err) {
    console.error("send-whatsapp error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
