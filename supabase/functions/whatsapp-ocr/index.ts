import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "Envie ao menos uma imagem (base64)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (images.length > 10) {
      return new Response(JSON.stringify({ error: "Máximo de 10 imagens por vez" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build vision messages — one user message with all images
    const imageContents = images.map((img: string) => ({
      type: "image_url" as const,
      image_url: {
        url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
      },
    }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um sistema de OCR especializado em extrair texto de screenshots de conversas de aplicativos de mensagens (WhatsApp, Instagram, Telegram, SMS, iMessage, Messenger, ou qualquer outro).

REGRAS CRÍTICAS:
- Identifique automaticamente o aplicativo de mensagens pelo visual do screenshot
- Extraia TODAS as mensagens visíveis nas imagens
- SEMPRE converta para o formato padronizado: "DD/MM/AAAA HH:MM - NomeDoContato: texto da mensagem"
- Se a data não estiver visível, use "01/01/2026 00:00" como placeholder
- Se o nome do contato não estiver claro, use "Contato" ou "Eu" conforme o lado da conversa
- Cada mensagem em uma nova linha
- Preserve os nomes dos participantes exatamente como aparecem
- Ignore elementos de interface (botões, ícones, barras de status, cabeçalhos do app)
- Não adicione comentários, explicações ou formatação extra
- Se houver múltiplas imagens, concatene as mensagens em ordem
- Mensagens de sistema (criptografia, mudança de número, notificações do app etc) devem ser ignoradas
- Retorne SOMENTE o texto extraído, nada mais`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extraia todas as mensagens de conversa ${images.length > 1 ? `dessas ${images.length} imagens` : "dessa imagem"} no formato padrão (DD/MM/AAAA HH:MM - Nome: mensagem):`,
              },
              ...imageContents,
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway OCR error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao processar imagens" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ success: true, text: extractedText }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-ocr error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
