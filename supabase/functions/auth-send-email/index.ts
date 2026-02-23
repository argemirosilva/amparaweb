import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildVerificacaoHtml(nome: string, codigo: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #fdf2f4; border-radius: 16px;">
      <h2 style="color: #b91c5c; margin-bottom: 8px;">AMPARA Mulher</h2>
      <p style="color: #333; font-size: 16px;">Olá${nome ? `, ${nome}` : ''}!</p>
      <p style="color: #555; font-size: 15px;">Seu código de verificação é:</p>
      <div style="background: #fff; border: 2px solid #f472b6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #b91c5c;">${codigo}</span>
      </div>
      <p style="color: #777; font-size: 13px;">Este código é válido por <strong>15 minutos</strong>.</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">Se você não solicitou este código, ignore este email.</p>
    </div>
  `;
}

function buildConviteHtml(nome: string, link: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #fdf2f4; border-radius: 16px;">
      <h2 style="color: #b91c5c; margin-bottom: 8px;">AMPARA Mulher</h2>
      <p style="color: #333; font-size: 16px;">Olá${nome ? `, ${nome}` : ''}!</p>
      <p style="color: #555; font-size: 15px;">Você foi convidado(a) a acessar o sistema AMPARA. Para configurar sua conta e criar sua senha, clique no botão abaixo:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${link}" style="display: inline-block; background: #b91c5c; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">Configurar minha conta</a>
      </div>
      <p style="color: #777; font-size: 13px;">Este link é válido por <strong>48 horas</strong>.</p>
      <p style="color: #999; font-size: 12px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p style="color: #b91c5c; font-size: 12px; word-break: break-all;">${link}</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">Se você não esperava este convite, ignore este email.</p>
    </div>
  `;
}

function buildResetHtml(nome: string, link: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px; background: #fdf2f4; border-radius: 16px;">
      <h2 style="color: #b91c5c; margin-bottom: 8px;">AMPARA Mulher</h2>
      <p style="color: #333; font-size: 16px;">Olá${nome ? `, ${nome}` : ''}!</p>
      <p style="color: #555; font-size: 15px;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${link}" style="display: inline-block; background: #b91c5c; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">Redefinir senha</a>
      </div>
      <p style="color: #777; font-size: 13px;">Este link é válido por <strong>1 hora</strong>.</p>
      <p style="color: #999; font-size: 12px;">Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p style="color: #b91c5c; font-size: 12px; word-break: break-all;">${link}</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">Se você não solicitou a redefinição, ignore este email. Sua senha permanecerá inalterada.</p>
    </div>
  `;
}

async function loadSmtpConfig(): Promise<{
  host: string; port: number; user: string; pass: string; from: string; ativa: boolean;
} | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("admin_settings")
    .select("chave, valor")
    .eq("categoria", "integracao_email");

  if (error || !data || data.length === 0) {
    console.error("Failed to load SMTP settings from DB:", error);
    return null;
  }

  const map: Record<string, string> = {};
  for (const row of data) {
    map[row.chave] = row.valor;
  }

  if (map.smtp_ativa === "false") {
    console.log("SMTP integration is disabled in admin_settings");
    return null;
  }

  const host = map.smtp_host;
  const user = map.smtp_user;
  const pass = map.smtp_pass;

  if (!host || !user || !pass) {
    // Fallback to env vars for backwards compat
    const envHost = Deno.env.get("SMTP_HOST");
    const envUser = Deno.env.get("SMTP_USER");
    const envPass = Deno.env.get("SMTP_PASS");
    if (envHost && envUser && envPass) {
      console.log("Using SMTP credentials from env vars (DB values empty)");
      return {
        host: envHost,
        port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
        user: envUser,
        pass: envPass,
        from: envUser,
        ativa: true,
      };
    }
    console.error("SMTP credentials not configured in DB or env");
    return null;
  }

  return {
    host,
    port: parseInt(map.smtp_port || "465"),
    user,
    pass,
    from: map.smtp_from || user,
    ativa: true,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, codigo, nome, tipo, link } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const smtp = await loadSmtpConfig();
    if (!smtp) {
      return new Response(JSON.stringify({ error: "Configuração de email não encontrada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject: string;
    let htmlBody: string;

    if (tipo === "convite") {
      if (!link) {
        return new Response(JSON.stringify({ error: "Link é obrigatório para convite" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      subject = "Convite para acessar AMPARA Mulher";
      htmlBody = buildConviteHtml(nome || "", link);
    } else if (tipo === "reset") {
      if (!link) {
        return new Response(JSON.stringify({ error: "Link é obrigatório para reset" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      subject = "Redefinir senha — AMPARA Mulher";
      htmlBody = buildResetHtml(nome || "", link);
    } else {
      if (!codigo) {
        return new Response(JSON.stringify({ error: "Código é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      subject = "Seu código de verificação AMPARA";
      htmlBody = buildVerificacaoHtml(nome || "", codigo);
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtp.host,
        port: smtp.port,
        tls: true,
        auth: {
          username: smtp.user,
          password: smtp.pass,
        },
      },
    });

    await client.send({
      from: smtp.from,
      to: email,
      subject,
      content: "auto",
      html: htmlBody,
    });

    await client.close();

    console.log(`Email (${tipo || "verificacao"}) sent to ${email}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send email error:", err);
    return new Response(JSON.stringify({ error: "Falha ao enviar email" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
