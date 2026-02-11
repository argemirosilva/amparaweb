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
    const { email, codigo, nome } = await req.json();

    if (!email || !codigo) {
      return new Response(JSON.stringify({ error: "Email e código são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      // Fallback: log that email would be sent (for development)
      console.log(`[DEV] Verification email for ${email} - code NOT logged for security`);
      return new Response(JSON.stringify({ success: true, dev_mode: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "AMPARA <noreply@resend.dev>",
        to: [email],
        subject: "Seu código de verificação AMPARA",
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend error:", errorText);
      return new Response(JSON.stringify({ error: "Falha ao enviar email" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send email error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
