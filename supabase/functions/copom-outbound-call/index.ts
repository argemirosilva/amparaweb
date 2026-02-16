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

    // Build the first_message with actual data embedded
    const loc = context?.location || {};
    const victim = context?.victim || {};
    const aggressor = context?.aggressor || {};
    const vehicle = aggressor?.vehicle || {};

    let firstMessage = `Comunicado urgente ao COPOM. Protocolo ${context?.protocol_id || "não disponível"}. ` +
      `Nível de risco: ${context?.risk_level || "não informado"}. ` +
      `Motivo do acionamento: ${context?.trigger_reason === "panico_manual" ? "botão de pânico acionado manualmente" : context?.trigger_reason || "não informado"}. ` +
      `Vítima: ${victim.name || "nome não disponível"}, telefone: ${victim.phone_masked || "não disponível"}. ` +
      `Localização atual: ${loc.address || "endereço não disponível"}. ` +
      `Coordenadas: latitude ${loc.lat ?? "não disponível"}, longitude ${loc.lng ?? "não disponível"}. ` +
      `Status de movimento: ${loc.movement_status || "não informado"}` +
      (loc.speed_kmh != null ? `, velocidade ${loc.speed_kmh} quilômetros por hora` : "") + `. `;

    const aggressorName = aggressor.name || aggressor.name_masked;
    if (aggressorName) {
      firstMessage += `Agressor identificado: ${aggressorName}. ${aggressor.description || ""}. `;
    }
    if (vehicle.model) {
      firstMessage += `Veículo possivelmente associado: ${vehicle.model} ${vehicle.color || ""}, placa parcial ${vehicle.plate_partial || "não disponível"}. ` +
        `Atenção: dados do veículo são ${aggressor.vehicle_note === "NAO_CONFIRMADO" ? "NÃO CONFIRMADOS" : "não confirmados"}. `;
    }
    if (context?.monitoring_link) {
      firstMessage += `Link de monitoramento em tempo real: ${context.monitoring_link}. `;
    }
    firstMessage += `NUNCA invente dados além do que foi informado. Se alguma informação não foi mencionada, diga que não está disponível no sistema neste momento.`;

    // Flatten context into dynamic_variables for ElevenLabs
    const dynamicVariables: Record<string, string> = {};
    if (context) {
      dynamicVariables.context_json = JSON.stringify(context);
      dynamicVariables.protocol_id = context.protocol_id || "";
      dynamicVariables.risk_level = context.risk_level || "";
      dynamicVariables.trigger_reason = context.trigger_reason || "";
      dynamicVariables.victim_name = context.victim?.name || "";
      dynamicVariables.victim_phone = context.victim?.phone_masked || "";
      dynamicVariables.location_address = context.location?.address || "";
      dynamicVariables.location_lat = String(context.location?.lat || "");
      dynamicVariables.location_lng = String(context.location?.lng || "");
      dynamicVariables.movement_status = context.location?.movement_status || "";
      dynamicVariables.speed_kmh = String(context.location?.speed_kmh ?? "");
      dynamicVariables.monitoring_link = context.monitoring_link || "";
      dynamicVariables.aggressor_name = context.aggressor?.name_masked || "";
      dynamicVariables.aggressor_description = context.aggressor?.description || "";
      dynamicVariables.vehicle_model = context.aggressor?.vehicle?.model || "";
      dynamicVariables.vehicle_color = context.aggressor?.vehicle?.color || "";
      dynamicVariables.vehicle_plate = context.aggressor?.vehicle?.plate_partial || "";
      dynamicVariables.vehicle_note = context.aggressor?.vehicle_note || "";
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
