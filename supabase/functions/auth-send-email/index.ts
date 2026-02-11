import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, codigo, nome } = await req.json();

    if (!email || !codigo) {
      return new Response(JSON.stringify({ error: "Email e código são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.error("SMTP credentials not configured");
      return new Response(JSON.stringify({ error: "Configuração de email não encontrada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlBody = `
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

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    await client.send({
      from: SMTP_USER,
      to: email,
      subject: "Seu código de verificação AMPARA",
      content: "auto",
      html: htmlBody,
    });

    await client.close();

    console.log(`Verification email sent to ${email}`);

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
