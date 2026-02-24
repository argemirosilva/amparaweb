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
      const { campaignId, contactName, ddd, phone, extraFields } = params;

      if (!campaignId || !contactName || !ddd || !phone) {
        return json({ error: "Campos obrigatórios: campaignId, contactName, ddd, phone" }, 400);
      }

      // Read API URL from admin_settings (fallback to default)
      const { data: urlSetting } = await supabase
        .from("admin_settings")
        .select("valor")
        .eq("chave", "agreggar_api_url")
        .maybeSingle();

      const baseUrl = urlSetting?.valor || "https://api.aggregar.com.br";

      const payload = {
        campaignId: Number(campaignId),
        contactName,
        ddd: String(ddd),
        phone: String(phone),
        lstExtraFieldValue: Array.isArray(extraFields) ? extraFields : [],
      };

      console.log("SpeedDial payload:", JSON.stringify(payload));

      const response = await fetch(`${baseUrl}/speedDial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      if (!response.ok) {
        return json({
          error: "Erro na API Agreggar",
          status: response.status,
          response: responseData,
        }, 502);
      }

      return json({ success: true, response: responseData });
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
