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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateAdminSession(sessionToken: string) {
  const supabase = getServiceClient();
  const tokenHash = await hashToken(sessionToken);
  const { data: session } = await supabase
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) return null;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id);

  const roleList = (roles || []).map((r: any) => r.role);
  const isAdmin = roleList.some((r: string) =>
    ["super_administrador", "administrador", "admin_master"].includes(r)
  );

  if (!isAdmin) return null;
  return { userId: session.user_id, roles: roleList };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { session_token, action, ...params } = body;

    if (!session_token) return json({ error: "Token de sessão obrigatório" }, 401);

    const admin = await validateAdminSession(session_token);
    if (!admin) return json({ error: "Sessão inválida ou sem permissão" }, 403);

    const supabase = getServiceClient();

    // ── speedDial ──
    if (action === "speedDial") {
      const { campaignId, contactName, ddd, phone, extraFields, context } = params;

      if (!campaignId || !contactName || !ddd || !phone) {
        return json({ error: "Campos obrigatórios: campaignId, contactName, ddd, phone" }, 400);
      }

      // Read SinergyTech settings (including cached token)
      const { data: stSettings } = await supabase
        .from("admin_settings")
        .select("chave, valor")
        .in("chave", [
          "sinergytech_api_url", "sinergytech_usuario", "sinergytech_senha",
          "sinergytech_token_cache", "sinergytech_token_expires",
        ]);

      const stMap = Object.fromEntries((stSettings || []).map((s: any) => [s.chave, s.valor]));
      const baseUrl = stMap["sinergytech_api_url"] || "https://api.aggregar.com.br";
      const stUser = stMap["sinergytech_usuario"] || "";
      const stPass = stMap["sinergytech_senha"] || "";

      // Utility: format value for voice agent reading (in-memory only)
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

      // Build lstExtraFieldValue automatically from context
      const autoFields: Array<{ fieldName: string; value: string }> = [];

      if (context) {
        const add = (fieldName: string, value: string | undefined | null) => {
          if (value) autoFields.push({ fieldName, value });
        };

        add("VITIMA_NOME", context.victim?.name);
        add("VITIMA_TELEFONE", context.victim?.phone_masked);

        // Address — extract only street, number and neighborhood
        const rawAddr = context.location?.address || "";
        const dashParts = rawAddr.split(" - ");
        const logradouroNumero = dashParts[0]?.trim() || "";
        const bairro = dashParts[1]?.trim() || "";
        const endereco = bairro ? `${logradouroNumero} - ${bairro}` : logradouroNumero;
        add("ENDERECO_ULTIMA_LOCALIZACAO", endereco || undefined);
        add("STATUS_MOVIMENTO", context.location?.movement_status);

        // Aggressor
        add("AGRESSOR_NOME", context.aggressor?.name || context.aggressor?.name_masked);
        add("RELACAO", context.victim_aggressor_relation);

        // Monitoring link — code formatted for voice
        const rawLink = context.monitoring_link || "";
        const pathMatch = rawLink.match(/\/([a-z0-9]{4,10})$/i);
        const code = pathMatch ? pathMatch[1] : rawLink;
        const codeSpeak = formatToSpeak(code, "codigo");
        add("LINK_MONITORAMENTO", codeSpeak || code || undefined);

        // Security
        add("AGRESSOR_TEM_ARMA", context.aggressor?.tem_arma ? "sim" : "não");

        const rawForca = context.aggressor?.forca_seguranca_tipo || "sim, tipo não especificado";
        add("AGRESSOR_FORCA_SEGURANCA", context.aggressor?.forca_seguranca
          ? rawForca.replace(/\s*\(.*?\)/g, "").trim()
          : "não");

        // Vehicle — plate formatted for voice
        const v = context.aggressor?.vehicle;
        let veiculoStr = "";
        if (v?.model && v?.color) {
          veiculoStr = `${v.model} de cor ${v.color}`;
        } else if (v?.model) {
          veiculoStr = v.model;
        } else if (v?.color) {
          veiculoStr = `cor ${v.color}`;
        }
        const plateSpeak = formatToSpeak(v?.plate_partial, "placa");
        if (v?.plate_partial) {
          veiculoStr = veiculoStr
            ? `${veiculoStr}, placa ${plateSpeak || v.plate_partial}`
            : `placa ${plateSpeak || v.plate_partial}`;
        }
        add("VEICULO", (veiculoStr || "não informado").replace(/,/g, ""));
      }

      // Merge: auto fields first, then any manual extraFields (manual overrides auto)
      const manualFields = Array.isArray(extraFields) ? extraFields : [];
      const manualNames = new Set(manualFields.map((f: any) => f.fieldName));
      const mergedFields = [
        ...autoFields.filter((f) => !manualNames.has(f.fieldName)),
        ...manualFields,
      ];

      const payload = {
        campaignId: Number(campaignId),
        contactName,
        ddd: String(ddd),
        phone: String(phone),
        lstExtraFieldValue: mergedFields,
      };

      const fullUrl = `${baseUrl}/speedDial`;
      console.log("SpeedDial URL:", fullUrl);
      console.log("SpeedDial payload:", JSON.stringify(payload));

      // Step 1: Get API token (use cache if valid, otherwise login)
      let apiToken = "";
      let tokenReused = false;
      const loginUrl = `${baseUrl}/login`;
      const cachedToken = stMap["sinergytech_token_cache"] || "";
      const cachedExpires = stMap["sinergytech_token_expires"] || "";
      const now = new Date();
      const TOKEN_LIFETIME_MS = 29 * 60 * 1000; // 29 minutes

      if (cachedToken && cachedExpires && new Date(cachedExpires) > now) {
        apiToken = cachedToken;
        tokenReused = true;
        console.log("Using cached SinergyTech token (expires:", cachedExpires, ")");
      } else if (stUser && stPass) {
        console.log("Token expired or missing, authenticating at:", loginUrl);
        const loginRes = await fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userName: stUser, password: stPass }),
        });
        const loginData = await loginRes.json();
        console.log("Login response:", JSON.stringify(loginData));
        if (!loginData.success || !loginData.token) {
          return json({
            error: "Falha na autenticação com a API SinergyTech",
            login_response: loginData,
            login_url: loginUrl,
          }, 401);
        }
        apiToken = loginData.token;

        // Cache the token with 29-minute expiration
        const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS).toISOString();
        const upsert = async (chave: string, valor: string) => {
          const { data: existing } = await supabase
            .from("admin_settings")
            .select("id")
            .eq("chave", chave)
            .maybeSingle();
          if (existing) {
            await supabase.from("admin_settings").update({ valor }).eq("chave", chave);
          } else {
            await supabase.from("admin_settings").insert({
              chave, valor, categoria: "integracao_sinergytech",
              descricao: chave === "sinergytech_token_cache" ? "Token de acesso cacheado (auto)" : "Expiração do token cacheado (auto)",
            });
          }
        };
        await Promise.all([
          upsert("sinergytech_token_cache", apiToken),
          upsert("sinergytech_token_expires", expiresAt),
        ]);
        console.log("Token cached until:", expiresAt);
      }

      // Step 2: Call speedDial with token in header
      const fetchHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(apiToken ? { token: apiToken } : {}),
      };

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      // Log in payload_integracoes
      try {
        await supabase.from("payload_integracoes").insert({
          integracao: "agreggar_speed_dial",
          user_id: admin.userId,
          payload: payload as any,
          resposta: responseData as any,
          sucesso: response.ok,
        });
      } catch (logErr) {
        console.error("Failed to log agreggar payload:", logErr);
      }

      // Audit log
      try {
        await supabase.from("audit_logs").insert({
          action_type: "agreggar_speed_dial",
          user_id: admin.userId,
          details: {
            campaignId,
            contactName,
            ddd,
            phone,
            success: response.ok,
            status: response.status,
          },
          success: response.ok,
        });
      } catch {}

      const requestDebug = {
        login_url: loginUrl,
        login_user: stUser,
        token_obtained: !!apiToken,
        token_reused_from_cache: tokenReused,
        speedDial_url: fullUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { token: apiToken } : {}),
        },
      };

      if (!response.ok) {
        return json({
          error: "Erro na API Agreggar",
          status: response.status,
          response: responseData,
          url_used: fullUrl,
          request_debug: requestDebug,
        }, 502);
      }

      return json({ success: true, response: responseData, url_used: fullUrl, request_debug: requestDebug });
    }

    // ── listHistory ──
    if (action === "listHistory") {
      const { data, error } = await supabase
        .from("payload_integracoes")
        .select("*")
        .eq("integracao", "agreggar_speed_dial")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) return json({ error: error.message }, 500);
      return json({ history: data || [] });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    console.error("Edge function error:", err);
    return json({ error: String(err) }, 500);
  }
});
