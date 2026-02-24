import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const context = body.context;
    const userId = body.user_id;
    const skipCooldown = body.skip_cooldown === true;

    const supabase = getServiceClient();

    // ── Resolve destination phone ──
    let phoneNumber = body.phone_number as string | undefined;
    if (!phoneNumber) {
      const { data: phoneSetting } = await supabase
        .from("admin_settings")
        .select("valor")
        .eq("chave", "copom_telefone_destino")
        .maybeSingle();
      // Fallback to legacy key
      if (!phoneSetting?.valor) {
        const { data: legacy } = await supabase
          .from("admin_settings")
          .select("valor")
          .eq("chave", "elevenlabs_copom_telefone")
          .maybeSingle();
        phoneNumber = legacy?.valor || undefined;
      } else {
        phoneNumber = phoneSetting.valor;
      }
    }

    if (!phoneNumber) {
      console.error("No COPOM phone number configured");
      return json({ error: "Telefone COPOM não configurado no painel administrativo" }, 400);
    }

    // ── Cooldown de 60 minutos ──
    if (userId && !skipCooldown) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentCalls } = await supabase
        .from("audit_logs")
        .select("id, created_at")
        .eq("action_type", "copom_outbound_call")
        .eq("user_id", userId)
        .gte("created_at", oneHourAgo)
        .limit(1);

      if (recentCalls && recentCalls.length > 0) {
        const lastCallAt = new Date(recentCalls[0].created_at);
        const minutesRemaining = Math.ceil((60 * 60 * 1000 - (Date.now() - lastCallAt.getTime())) / 60000);
        return json({
          error: "cooldown_active",
          message: `Ligação COPOM bloqueada. Aguarde ${minutesRemaining} minuto(s).`,
          minutes_remaining: minutesRemaining,
          last_call_at: recentCalls[0].created_at,
        }, 429);
      }
    }

    // ── Read SinergyTech settings ──
    const { data: stSettings } = await supabase
      .from("admin_settings")
      .select("chave, valor")
      .in("chave", [
        "sinergytech_api_url", "sinergytech_usuario", "sinergytech_senha",
        "sinergytech_campaign_id",
        "sinergytech_token_cache", "sinergytech_token_expires",
      ]);

    const stMap = Object.fromEntries((stSettings || []).map((s: any) => [s.chave, s.valor]));
    const baseUrl = stMap["sinergytech_api_url"] || "https://api.aggregar.com.br";
    const stUser = stMap["sinergytech_usuario"] || "";
    const stPass = stMap["sinergytech_senha"] || "";
    const campaignId = stMap["sinergytech_campaign_id"] || "1506";

    if (!stUser || !stPass) {
      return json({ error: "Credenciais SinergyTech não configuradas" }, 500);
    }

    // ── Parse phone numbers and call each ──
    const phoneNumbers = phoneNumber
      .split(",")
      .map((p: string) => p.trim().replace(/\D/g, ""))
      .filter((p: string) => p.length >= 10);

    if (phoneNumbers.length === 0) {
      return json({ error: "Nenhum telefone válido configurado" }, 400);
    }

    // ── Utility: format value for voice agent reading ──
    function formatToSpeak(value: string | undefined | null, mode: string): string {
      if (!value) return "";
      let clean = "";
      switch (mode) {
        case "placa":
        case "codigo":
          clean = value.replace(/[^a-zA-Z0-9]/g, "");
          break;
        case "telefone":
          clean = value.replace(/\D/g, "");
          break;
        default:
          clean = value;
      }
      return clean.split("").join(" ");
    }

    // ── Build context extra fields ──
    const autoFields: Array<{ fieldName: string; value: string }> = [];
    if (context) {
      const add = (fieldName: string, value: string | undefined | null) => {
        if (value) autoFields.push({ fieldName, value });
      };
      add("VITIMA_NOME", context.victim?.name);
      add("VITIMA_TELEFONE", context.victim?.phone_masked);
      const rawAddr = context.location?.address || "";
      const dashParts = rawAddr.split(" - ");
      const logradouroNumero = dashParts[0]?.trim() || "";
      const bairro = dashParts[1]?.trim() || "";
      const endereco = bairro ? `${logradouroNumero} - ${bairro}` : logradouroNumero;
      add("ENDERECO_ULTIMA_LOCALIZACAO", endereco || undefined);
      add("STATUS_MOVIMENTO", context.location?.movement_status);
      add("AGRESSOR_NOME", context.aggressor?.name || context.aggressor?.name_masked);
      add("RELACAO", context.victim_aggressor_relation);
      // Monitoring link — 6-digit numeric code, formatted for voice
      const code = (context.monitoring_link || "").replace(/\D/g, "");
      const codeSpeak = code ? code.split("").join(" ") : "";
      add("LINK_MONITORAMENTO", codeSpeak || code || undefined);
      add("AGRESSOR_TEM_ARMA", context.aggressor?.tem_arma ? "sim" : "não");
      const rawForca = context.aggressor?.forca_seguranca_tipo || "sim, tipo não especificado";
      add("AGRESSOR_FORCA_SEGURANCA", context.aggressor?.forca_seguranca
        ? rawForca.replace(/\s*\(.*?\)/g, "").trim()
        : "não");
      const v = context.aggressor?.vehicle;
      let veiculoStr = "";
      if (v?.model && v?.color) veiculoStr = `${v.model} de cor ${v.color}`;
      else if (v?.model) veiculoStr = v.model;
      else if (v?.color) veiculoStr = `cor ${v.color}`;
      const plateSpeak = formatToSpeak(v?.plate_partial, "placa");
      if (v?.plate_partial) veiculoStr = veiculoStr ? `${veiculoStr} placa ${plateSpeak || v.plate_partial}` : `placa ${plateSpeak || v.plate_partial}`;
      add("VEICULO", (veiculoStr || "não informado").replace(/,/g, ""));
    }

    // ── Authenticate with SinergyTech ──
    let apiToken = "";
    const TOKEN_LIFETIME_MS = 29 * 60 * 1000;
    const now = new Date();
    const cachedToken = stMap["sinergytech_token_cache"] || "";
    const cachedExpires = stMap["sinergytech_token_expires"] || "";

    if (cachedToken && cachedExpires && new Date(cachedExpires) > now) {
      apiToken = cachedToken;
      console.log("Using cached SinergyTech token");
    } else {
      const loginUrl = `${baseUrl}/login`;
      console.log("Authenticating at:", loginUrl);
      const loginRes = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: stUser, password: stPass }),
      });
      const loginData = await loginRes.json();
      if (!loginData.success || !loginData.token) {
        return json({ error: "Falha na autenticação com a API SinergyTech", login_response: loginData }, 401);
      }
      apiToken = loginData.token;

      // Cache token
      const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS).toISOString();
      const upsert = async (chave: string, valor: string) => {
        const { data: existing } = await supabase.from("admin_settings").select("id").eq("chave", chave).maybeSingle();
        if (existing) await supabase.from("admin_settings").update({ valor }).eq("chave", chave);
        else await supabase.from("admin_settings").insert({ chave, valor, categoria: "integracao_sinergytech", descricao: "Cache automático" });
      };
      await Promise.all([
        upsert("sinergytech_token_cache", apiToken),
        upsert("sinergytech_token_expires", expiresAt),
      ]);
    }

    // ── Fire SpeedDial for each phone number ──
    const fullUrl = `${baseUrl}/speedDial`;
    const callPromises = phoneNumbers.map(async (num: string) => {
      const ddd = num.slice(0, 2);
      const phone = num.slice(2);
      const contactName = context?.victim?.name || "Vítima AMPARA";

      const payload = {
        campaignId: Number(campaignId),
        contactName,
        ddd,
        phone,
        lstExtraFieldValue: autoFields,
      };

      try {
        const response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: apiToken },
          body: JSON.stringify(payload),
        });
        const responseText = await response.text();
        let result;
        try { result = JSON.parse(responseText); } catch { result = { raw: responseText }; }

        // Log payload
        try {
          await supabase.from("payload_integracoes").insert({
            integracao: "copom_sinergytech_speeddial",
            user_id: userId || null,
            protocol_id: context?.protocol_id || null,
            payload: payload as any,
            resposta: result as any,
            sucesso: response.ok,
          });
        } catch (logErr) { console.error("Failed to log payload:", logErr); }

        if (!response.ok) {
          console.error(`SpeedDial error for ${ddd}${phone}:`, response.status, responseText);
          return { phone: `${ddd}${phone}`, success: false, status: response.status, error: responseText };
        }
        console.log(`SpeedDial initiated to ${ddd}${phone}:`, result);
        return { phone: `${ddd}${phone}`, success: true, result };
      } catch (e) {
        console.error(`Call failed for ${ddd}${phone}:`, e);
        return { phone: `${ddd}${phone}`, success: false, error: String(e) };
      }
    });

    const results = await Promise.all(callPromises);
    const anySuccess = results.some((r) => r.success);

    if (!anySuccess) {
      return json({ error: "Todas as ligações falharam", details: results }, 502);
    }

    // Audit log
    if (userId) {
      try {
        await supabase.from("audit_logs").insert({
          action_type: "copom_outbound_call",
          user_id: userId,
          details: {
            protocol_id: context?.protocol_id,
            phone_numbers: phoneNumbers,
            results: results.map((r) => ({ phone: r.phone, success: r.success })),
            integration: "sinergytech_speeddial",
          },
          success: anySuccess,
        });
      } catch (logErr) {
        console.error("Failed to log COPOM call:", logErr);
      }
    }

    return json({ success: true, calls: results });
  } catch (err) {
    console.error("Edge function error:", err);
    return json({ error: String(err) }, 500);
  }
});
