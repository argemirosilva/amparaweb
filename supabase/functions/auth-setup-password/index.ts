import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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

    const { email, token, nova_senha, tipo } = await req.json();
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const emailClean = email?.trim().toLowerCase();

    if (!emailClean || !token || !nova_senha) {
      return new Response(JSON.stringify({ error: "Email, token e nova senha são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (nova_senha.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: attempts } = await supabase
      .from("rate_limit_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", `${emailClean}:setup`)
      .eq("action_type", "setup_password")
      .gte("attempted_at", fifteenMinAgo);

    if ((attempts || 0) >= 10) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 15 minutos" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("rate_limit_attempts").insert({
      identifier: `${emailClean}:setup`,
      action_type: "setup_password",
    });

    // Find user
    const { data: user } = await supabase
      .from("usuarios")
      .select("id, codigo_verificacao, codigo_verificacao_expira, email_verificado")
      .eq("email", emailClean)
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    if (!user.codigo_verificacao || user.codigo_verificacao !== token) {
      return new Response(JSON.stringify({ error: "Token inválido ou já utilizado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expira = user.codigo_verificacao_expira ? new Date(user.codigo_verificacao_expira) : null;
    if (!expira || new Date() > expira) {
      return new Response(JSON.stringify({ error: "Token expirado. Solicite um novo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hash new password
    const senhaHash = bcrypt.hashSync(nova_senha);

    // Update user
    const updateData: Record<string, any> = {
      senha_hash: senhaHash,
      codigo_verificacao: null,
      codigo_verificacao_expira: null,
      updated_at: new Date().toISOString(),
    };

    // For invite setup (not password reset), also verify email and activate
    if (tipo === "convite" || !user.email_verificado) {
      updateData.email_verificado = true;
      updateData.status = "ativo";
    }

    await supabase.from("usuarios").update(updateData).eq("id", user.id);

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: tipo === "reset" ? "password_reset" : "account_setup",
      success: true,
      ip_address: ip,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Setup password error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
