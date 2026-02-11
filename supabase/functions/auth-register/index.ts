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

    const { nome_completo, telefone, email, senha, termos_aceitos } = await req.json();
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    // Validate inputs
    const emailClean = email?.trim().toLowerCase();
    if (!nome_completo || !emailClean || !telefone || !senha) {
      return new Response(JSON.stringify({ error: "Todos os campos são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneDigits = telefone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      return new Response(JSON.stringify({ error: "Telefone deve ter 10 ou 11 dígitos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (senha.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5 attempts per 15 min
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: attempts } = await supabase
      .from("rate_limit_attempts")
      .select("*", { count: "exact", head: true })
      .eq("identifier", emailClean)
      .eq("action_type", "register")
      .gte("attempted_at", fifteenMinAgo);

    if ((attempts || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde 15 minutos" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record attempt
    await supabase.from("rate_limit_attempts").insert({
      identifier: emailClean, action_type: "register",
    });

    // Check if email already exists
    const { data: existing } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", emailClean)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Este email já está cadastrado" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate verification code (5 digits, zero-padded)
    const codigo = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
    const codigoExpira = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Hash password with bcrypt
    const senhaHash = bcrypt.hashSync(senha);

    // Insert user
    const { data: user, error: insertError } = await supabase
      .from("usuarios")
      .insert({
        nome_completo: nome_completo.trim(),
        telefone: phoneDigits,
        email: emailClean,
        status: "pendente",
        email_verificado: false,
        codigo_verificacao: codigo,
        codigo_verificacao_expira: codigoExpira,
        senha_hash: senhaHash,
        termos_aceitos_em: termos_aceitos ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao criar conta" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action_type: "register",
      success: true,
      ip_address: ip,
      details: { email: emailClean },
    });

    // Send verification email via Supabase edge function
    try {
      const emailRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/auth-send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ email: emailClean, codigo, nome: nome_completo.trim() }),
        }
      );
      if (!emailRes.ok) {
        console.error("Email send failed:", await emailRes.text());
      }
    } catch (e) {
      console.error("Email send error:", e);
    }

    return new Response(JSON.stringify({ success: true, email: emailClean }), {
      status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Register error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
