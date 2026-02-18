import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
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

    const { email, app_url } = await req.json();
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const emailClean = email?.trim().toLowerCase();

    if (!emailClean) {
      return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 3 per 15 min
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: attempts } = await supabase
      .from("rate_limit_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", `${emailClean}:${ip}`)
      .eq("action_type", "reset_request")
      .gte("attempted_at", fifteenMinAgo);

    if ((attempts || 0) >= 3) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 15 minutos" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("rate_limit_attempts").insert({
      identifier: `${emailClean}:${ip}`,
      action_type: "reset_request",
    });

    // Find user (don't reveal if user exists)
    const { data: user } = await supabase
      .from("usuarios")
      .select("id, nome_completo")
      .eq("email", emailClean)
      .maybeSingle();

    // Always return success to prevent email enumeration
    if (!user) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate reset token (1 hour expiry)
    const resetToken = generateSecureToken(32);
    const tokenExpira = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase
      .from("usuarios")
      .update({
        codigo_verificacao: resetToken,
        codigo_verificacao_expira: tokenExpira,
      })
      .eq("id", user.id);

    // Send reset email
    const baseUrl = app_url || "https://ampamamulher.lovable.app";
    const resetLink = `${baseUrl}/redefinir-senha?token=${resetToken}&email=${encodeURIComponent(emailClean)}`;

    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auth-send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          email: emailClean,
          nome: user.nome_completo,
          tipo: "reset",
          link: resetLink,
        }),
      });
    } catch (e) {
      console.error("Email send error:", e);
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "password_reset_request",
      success: true,
      ip_address: ip,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Reset request error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
