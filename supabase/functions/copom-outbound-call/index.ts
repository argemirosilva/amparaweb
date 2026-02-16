import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const PHONE_NUMBER_ID = Deno.env.get("ELEVENLABS_PHONE_NUMBER_ID")!;
const AGENT_ID = "agent_5901khfc47ksfg0ay6h66vxrz0j3";
const TEST_PHONE_NUMBER = "+5514997406686";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const context = body.context; // CopomContextPayload
    const phoneNumber = body.phone_number || TEST_PHONE_NUMBER;
    const userId = body.user_id;
    const skipCooldown = body.skip_cooldown === true; // for test mode

    // ── Cooldown de 60 minutos ──
    if (userId && !skipCooldown) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseServiceKey);

      // Check last COPOM call for this user in audit_logs
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentCalls } = await sb
        .from("audit_logs")
        .select("id, created_at")
        .eq("action_type", "copom_outbound_call")
        .eq("user_id", userId)
        .gte("created_at", oneHourAgo)
        .limit(1);

      if (recentCalls && recentCalls.length > 0) {
        const lastCallAt = new Date(recentCalls[0].created_at);
        const minutesRemaining = Math.ceil((60 * 60 * 1000 - (Date.now() - lastCallAt.getTime())) / 60000);
        console.log(`COPOM cooldown active for user ${userId}. ${minutesRemaining}min remaining.`);
        return new Response(
          JSON.stringify({
            error: "cooldown_active",
            message: `Ligação COPOM bloqueada. Aguarde ${minutesRemaining} minuto(s) antes de tentar novamente.`,
            minutes_remaining: minutesRemaining,
            last_call_at: recentCalls[0].created_at,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!ELEVENLABS_API_KEY || !PHONE_NUMBER_ID) {
      return new Response(
        JSON.stringify({ error: "Missing ElevenLabs credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build first_message matching the official AMPARA agent opening script
    const victimName = context?.victim?.name || "nome não disponível";
    const aggressorName = context?.aggressor?.name || context?.aggressor?.name_masked || "";

    let firstMessage: string;
    if (aggressorName) {
      firstMessage = `Aqui é do AMPARA, sistema de proteção à mulher. Monitoramos a vítima ${victimName}. Há indícios de possível situação de risco envolvendo ${aggressorName}. Solicito atendimento com urgência.`;
    } else {
      firstMessage = `Aqui é do AMPARA, sistema de proteção à mulher. Monitoramos a vítima ${victimName}. Há indícios de possível situação de risco envolvendo um possível agressor. Não temos o nome do possível agressor no momento. Solicito atendimento com urgência.`;
    }

    // Flatten context into dynamic_variables matching ElevenLabs agent prompt placeholders
    const dynamicVariables: Record<string, string> = {};
    if (context) {
      dynamicVariables.VITIMA_NOME = context.victim?.name || "";
      dynamicVariables.VITIMA_TELEFONE = context.victim?.phone_masked || "";
      dynamicVariables.ENDERECO_ULTIMA_LOCALIZACAO = context.location?.address || "";
      dynamicVariables.STATUS_MOVIMENTO = context.location?.movement_status || "";
      dynamicVariables.AGRESSOR_NOME = context.aggressor?.name || context.aggressor?.name_masked || "";
      dynamicVariables.AGRESSOR_DESCRICAO = context.aggressor?.description || "";
      dynamicVariables.RELACAO = context.victim_aggressor_relation || "";
      // Remove protocol (https://) and www for cleaner speech
      const rawLink = context.monitoring_link || "";
      dynamicVariables.LINK_MONITORAMENTO = rawLink.replace(/^https?:\/\/(www\.)?/, "");
    }

    // Call ElevenLabs Outbound Call API
    const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound_call", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        agent_phone_number_id: PHONE_NUMBER_ID,
        to_number: phoneNumber,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
        },
        first_message: firstMessage,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("ElevenLabs API error:", response.status, responseText);
      return new Response(
        JSON.stringify({
          error: "ElevenLabs API error",
          status: response.status,
          details: responseText,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log("Outbound call initiated:", result);

    // Log successful call for cooldown tracking
    if (userId) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, supabaseServiceKey);
        await sb.from("audit_logs").insert({
          action_type: "copom_outbound_call",
          user_id: userId,
          details: { protocol_id: context?.protocol_id, phone_number: phoneNumber },
          success: true,
        });
      } catch (logErr) {
        console.error("Failed to log COPOM call:", logErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, call: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
