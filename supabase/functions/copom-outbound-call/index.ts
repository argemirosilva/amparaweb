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

    if (!ELEVENLABS_API_KEY || !PHONE_NUMBER_ID) {
      return new Response(
        JSON.stringify({ error: "Missing ElevenLabs credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the first_message with context for the agent
    const firstMessage =
      "Iniciar comunicado de urgência ao COPOM usando SOMENTE o contexto COPOM_ALERT_CONTEXT. " +
      "NUNCA invente dados. Se faltar algo, diga: 'essa informação não está disponível no sistema neste momento'. " +
      "Não afirmar certeza. Se movement_status for VEICULO e houver dados de vehicle, cite como NAO_CONFIRMADO.";

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
        conversation_initiation_client_data: context || undefined,
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
