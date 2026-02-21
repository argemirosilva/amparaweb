import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ---------- Google OAuth2 via individual secrets ---------- */

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Clean the PEM key - handle various formats
  let b64 = pem;
  
  // Replace escaped newlines
  b64 = b64.replace(/\\n/g, "\n");
  
  // Remove PEM envelope if present
  b64 = b64.replace(/-----BEGIN PRIVATE KEY-----/g, "");
  b64 = b64.replace(/-----END PRIVATE KEY-----/g, "");
  
  // Remove all whitespace
  b64 = b64.replace(/[\n\r\s]/g, "");
  
  // PKCS8 RSA keys always start with "MIIE" - trim any prefix junk
  const miieIdx = b64.indexOf("MIIE");
  if (miieIdx > 0) {
    console.log(`Trimming ${miieIdx} junk chars before MIIE`);
    b64 = b64.substring(miieIdx);
  }
  
  console.log("PEM base64 length:", b64.length, "first 20:", b64.substring(0, 20));
  
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

async function getGoogleAccessToken(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = "https://oauth2.googleapis.com/token";
  const scope = "https://www.googleapis.com/auth/cloud-platform";

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope,
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
  );

  const key = await importPrivateKey(privateKey);
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
    throw new Error(`Google token error: ${tokenRes.status} ${txt}`);
  }
  const { access_token } = await tokenRes.json();
  return access_token;
}

/* ---------- Emotion prompts ---------- */

const EMOTIONS = [
  {
    key: "radiante",
    prompt:
      "A portrait of a person [1] looking radiante and joyful. Open smile, bright sparkling eyes, warm golden-hour glow on the skin. Soft warm lighting. Professional portrait style.",
  },
  {
    key: "tranquila",
    prompt:
      "A portrait of a person [1] looking serene and calm. Gentle soft smile, relaxed eyes, peaceful expression. Soft diffused natural lighting. Professional portrait style.",
  },
  {
    key: "neutra",
    prompt:
      "A portrait of a person [1] with a completely neutral expression. Relaxed facial muscles, neutral mouth, steady calm gaze. Even flat studio lighting. Professional portrait style.",
  },
  {
    key: "desgastada",
    prompt:
      "A portrait of a person [1] looking exhausted and worn out. Tired droopy eyes, slightly furrowed brow, tense jaw, faint under-eye circles. Slightly desaturated cool lighting. Professional portrait style.",
  },
  {
    key: "triste",
    prompt:
      "A portrait of a person [1] looking deeply sad. Downturned mouth, watery glassy eyes, sorrowful expression, slightly lowered head. Cool blue-toned soft lighting. Professional portrait style.",
  },
  {
    key: "em_colapso",
    prompt:
      "A portrait of a person [1] in extreme emotional distress. Wide frightened eyes, open mouth as if crying out, disheveled hair, tear streaks on cheeks, visible anguish. Dramatic harsh contrasted lighting. Professional portrait style.",
  },
];

/* ---------- Vertex AI Imagen call ---------- */

async function generateEmotionImage(
  accessToken: string,
  projectId: string,
  location: string,
  baseImageB64: string,
  prompt: string
): Promise<string> {
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-capability-001:predict`;

  // Log request size for debugging
  console.log("Base image B64 length:", baseImageB64.length);
  
  const body = {
    instances: [
      {
        prompt,
        referenceImages: [
          {
            referenceType: "REFERENCE_TYPE_SUBJECT",
            referenceId: 1,
            referenceImage: {
              bytesBase64Encoded: baseImageB64,
            },
            subjectImageConfig: {
              subjectDescription: "a woman",
              subjectType: "SUBJECT_TYPE_PERSON",
            },
          },
        ],
      },
    ],
    parameters: {
      sampleCount: 1,
      personGeneration: "allow_all",
    },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Imagen API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const generated = data.predictions?.[0]?.bytesBase64Encoded;
  if (!generated) {
    throw new Error("No image returned from Imagen API");
  }
  return generated;
}

/* ---------- Main handler ---------- */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, sessionToken } = await req.json();
    if (!userId) return json({ error: "userId required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gcpProjectId = Deno.env.get("GCP_PROJECT_ID");
    const gcpClientEmail = Deno.env.get("GCP_CLIENT_EMAIL");
    const gcpPrivateKey = Deno.env.get("GCP_PRIVATE_KEY");

    if (!gcpProjectId || !gcpClientEmail || !gcpPrivateKey) {
      return json({ error: "GCP credentials not configured (GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY)" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Optional: validate session
    if (sessionToken) {
      const encoder = new TextEncoder();
      const hashBuf = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(sessionToken)
      );
      const tokenHash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data: sess } = await supabase
        .from("user_sessions")
        .select("user_id")
        .eq("token_hash", tokenHash)
        .gt("expires_at", new Date().toISOString())
        .is("revoked_at", null)
        .maybeSingle();

      if (!sess || sess.user_id !== userId) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    // 1. Fetch user avatar
    const { data: user } = await supabase
      .from("usuarios")
      .select("avatar_url")
      .eq("id", userId)
      .single();

    if (!user?.avatar_url) {
      return json({ error: "User has no avatar" }, 400);
    }

    // 2. Download avatar image
    console.log("Downloading avatar:", user.avatar_url);
    const avatarRes = await fetch(user.avatar_url);
    if (!avatarRes.ok) {
      return json({ error: "Failed to download avatar" }, 500);
    }
    const avatarBytes = new Uint8Array(await avatarRes.arrayBuffer());
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < avatarBytes.length; i += chunkSize) {
      const chunk = avatarBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const baseImageB64 = btoa(binary);

    // 3. Get Google access token using individual secrets
    console.log("Getting Google access token for project:", gcpProjectId);
    const accessToken = await getGoogleAccessToken(gcpClientEmail, gcpPrivateKey);
    const location = "us-central1";

    // 4. Generate 6 emotional variations
    const emotionalAvatars: Record<string, string> = {};
    const errors: string[] = [];

    for (const emotion of EMOTIONS) {
      try {
        console.log(`Generating emotion: ${emotion.key}`);
        const generatedB64 = await generateEmotionImage(
          accessToken,
          gcpProjectId,
          location,
          baseImageB64,
          emotion.prompt
        );

        const rawBinary = atob(generatedB64);
        const imgBytes = new Uint8Array(rawBinary.length);
        for (let i = 0; i < rawBinary.length; i++) {
          imgBytes[i] = rawBinary.charCodeAt(i);
        }

        const storagePath = `${userId}/${emotion.key}.webp`;
        const { error: uploadErr } = await supabase.storage
          .from("user-emotions")
          .upload(storagePath, imgBytes, {
            contentType: "image/webp",
            upsert: true,
          });

        if (uploadErr) {
          console.error(`Upload error for ${emotion.key}:`, uploadErr);
          errors.push(`${emotion.key}: upload failed`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("user-emotions")
          .getPublicUrl(storagePath);

        emotionalAvatars[emotion.key] = urlData.publicUrl;
        console.log(`✓ ${emotion.key} done`);
      } catch (err) {
        console.error(`Error generating ${emotion.key}:`, err);
        errors.push(`${emotion.key}: ${err.message}`);
      }
    }

    // 5. Save JSON to usuarios
    if (Object.keys(emotionalAvatars).length > 0) {
      const { error: updateErr } = await supabase
        .from("usuarios")
        .update({ emotional_avatars: emotionalAvatars })
        .eq("id", userId);

      if (updateErr) {
        console.error("Error updating emotional_avatars:", updateErr);
        return json({
          error: "Failed to save emotional_avatars",
          generated: Object.keys(emotionalAvatars).length,
        }, 500);
      }
    }

    return json({
      success: true,
      generated: Object.keys(emotionalAvatars).length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      emotional_avatars: emotionalAvatars,
    });
  } catch (err) {
    console.error("generate-emotional-avatars error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
