import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateToken(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

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

    const { email, senha } = await req.json();
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const emailClean = email?.trim().toLowerCase();

    if (!emailClean || !senha) {
      return new Response(JSON.stringify({ error: "Email e senha são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: attempts } = await supabase
      .from("rate_limit_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", `${emailClean}:${ip}`)
      .eq("action_type", "login")
      .gte("attempted_at", fifteenMinAgo);

    if ((attempts || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 15 minutos" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record attempt
    await supabase.from("rate_limit_attempts").insert({
      identifier: `${emailClean}:${ip}`,
      action_type: "login",
    });

    // Find user
    const { data: user } = await supabase
      .from("usuarios")
      .select("id, email, nome_completo, senha_hash, email_verificado, status")
      .eq("email", emailClean)
      .maybeSingle();

    if (!user) {
      await supabase.from("audit_logs").insert({
        action_type: "login_failed", success: false, ip_address: ip,
        details: { reason: "user_not_found" },
      });
      return new Response(JSON.stringify({ error: "Email ou senha incorretos" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check password
    const passwordMatch = bcrypt.compareSync(senha, user.senha_hash);
    if (!passwordMatch) {
      await supabase.from("audit_logs").insert({
        user_id: user.id, action_type: "login_failed", success: false, ip_address: ip,
        details: { reason: "wrong_password" },
      });
      return new Response(JSON.stringify({ error: "Email ou senha incorretos" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email verified
    if (!user.email_verificado) {
      return new Response(JSON.stringify({
        error: "Email não verificado",
        redirect: "verify",
        email: emailClean,
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create session
    const token = generateToken(64);
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("user_sessions").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      ip_address: ip,
      user_agent: req.headers.get("user-agent") || null,
    });

    // Update last access
    await supabase.from("usuarios").update({ ultimo_acesso: new Date().toISOString() }).eq("id", user.id);

    // Audit logs
    await supabase.from("audit_logs").insert({
      user_id: user.id, action_type: "login_success", success: true, ip_address: ip,
    });
    await supabase.from("audit_logs").insert({
      user_id: user.id, action_type: "session_created", success: true, ip_address: ip,
    });

    return new Response(JSON.stringify({
      success: true,
      session: { token, expires_at: expiresAt },
      usuario: {
        id: user.id,
        email: user.email,
        nome_completo: user.nome_completo,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Login error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
