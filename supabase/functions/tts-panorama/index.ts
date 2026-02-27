import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

/* ---------- Google OAuth2 (same pattern as generate-emotional-avatars) ---------- */

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  let b64 = pem;
  b64 = b64.replace(/\\n/g, "\n");
  b64 = b64.replace(/-----BEGIN PRIVATE KEY-----/g, "");
  b64 = b64.replace(/-----END PRIVATE KEY-----/g, "");
  b64 = b64.replace(/[\n\r\s]/g, "");

  const miieIdx = b64.indexOf("MIIE");
  if (miieIdx > 0) {
    b64 = b64.substring(miieIdx);
  }

  const binaryDer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64url(data: Uint8Array | string): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getGcpAccessToken(): Promise<string> {
  const email = Deno.env.get("GCP_CLIENT_EMAIL")!;
  const rawKey = Deno.env.get("GCP_PRIVATE_KEY")!;

  const now = Math.floor(Date.now() / 1000);
  const tokenUri = "https://oauth2.googleapis.com/token";

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
  );

  const key = await importPrivateKey(rawKey);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(`${header}.${payload}`)
    )
  );
  const jwt = `${header}.${payload}.${base64url(sig)}`;

  const tokenRes = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`GCP token error: ${tokenRes.status} ${txt}`);
  }
  const { access_token } = await tokenRes.json();
  return access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, session_token } = await req.json();

    if (!session_token || !text) {
      return new Response(
        JSON.stringify({ error: "text e session_token obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const tokenHash = await hashToken(session_token);
    const { data: session } = await supabase
      .from("user_sessions")
      .select("id, user_id, expires_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (!session || new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeText = text.slice(0, 5000);
    const accessToken = await getGcpAccessToken();

    const ttsRes = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: safeText },
          voice: {
            languageCode: "pt-BR",
            name: "pt-BR-Wavenet-A",
            ssmlGender: "FEMALE",
          },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );

    if (!ttsRes.ok) {
      const err = await ttsRes.text();
      console.error("TTS API error:", err);
      return new Response(
        JSON.stringify({ error: "Erro ao sintetizar áudio" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ttsData = await ttsRes.json();

    return new Response(
      JSON.stringify({ audioContent: ttsData.audioContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("tts-panorama error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
