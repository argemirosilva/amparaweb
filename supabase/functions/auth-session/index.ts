import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { session_token } = await req.json();

    if (!session_token) {
      return new Response(JSON.stringify({ error: "Token obrigatório", valid: false }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenHash = await hashToken(session_token);

    const { data: session } = await supabase
      .from("user_sessions")
      .select("id, user_id, expires_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (!session || new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada", valid: false }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: user } = await supabase
      .from("usuarios")
      .select("id, email, nome_completo")
      .eq("id", session.user_id)
      .single();

    return new Response(JSON.stringify({ valid: true, usuario: user }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Session check error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", valid: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
