import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, codigo, resend } = await req.json();
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const emailClean = email?.trim().toLowerCase();

    if (!emailClean) {
      return new Response(JSON.stringify({ error: "Email obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: attempts } = await supabase
      .from("rate_limit_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", `${emailClean}:${ip}`)
      .eq("action_type", "verify_code")
      .gte("attempted_at", fifteenMinAgo);

    if ((attempts || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 15 minutos" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user
    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("id, codigo_verificacao, codigo_verificacao_expira, nome_completo, email_verificado")
      .eq("email", emailClean)
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ error: "Usuária não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.email_verificado) {
      return new Response(JSON.stringify({ success: true, already_verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resend code
    if (resend) {
      const novoCodigo = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
      const novaExpira = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await supabase
        .from("usuarios")
        .update({
          codigo_verificacao: novoCodigo,
          codigo_verificacao_expira: novaExpira,
        })
        .eq("id", user.id);

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action_type: "profile_update",
        success: true,
        ip_address: ip,
        details: { resend_code: true },
      });

      // Send email
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auth-send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ email: emailClean, codigo: novoCodigo, nome: user.nome_completo }),
        });
      } catch (e) {
        console.error("Email resend error:", e);
      }

      return new Response(JSON.stringify({ success: true, resent: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify code
    if (!codigo) {
      return new Response(JSON.stringify({ error: "Código obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record attempt
    await supabase.from("rate_limit_attempts").insert({
      identifier: `${emailClean}:${ip}`,
      action_type: "verify_code",
    });

    const now = new Date();
    const expira = user.codigo_verificacao_expira ? new Date(user.codigo_verificacao_expira) : null;

    if (!expira || now > expira) {
      return new Response(JSON.stringify({ error: "Código expirado. Solicite um novo código" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.codigo_verificacao !== codigo) {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Code matches - verify user
    await supabase
      .from("usuarios")
      .update({
        email_verificado: true,
        status: "ativo",
        codigo_verificacao: null,
        codigo_verificacao_expira: null,
        ultimo_acesso: new Date().toISOString(),
      })
      .eq("id", user.id);

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "profile_update",
      success: true,
      ip_address: ip,
      details: { email_verificado: true },
    });

    return new Response(JSON.stringify({ success: true, verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Verify error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
