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

/* ---------- Google OAuth2 via Service Account ---------- */

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
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
  serviceAccountJson: string,
  scope: string
): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: sa.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const key = await importPrivateKey(sa.private_key);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(`${header}.${payload}`)
    )
  );
  const jwt = `${header}.${payload}.${base64url(sig)}`;

  const tokenRes = await fetch(
    sa.token_uri || "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    }
  );
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
      "Transform this portrait to show the person looking radiante and joyful. Open smile, bright sparkling eyes, warm golden-hour glow on the skin. Keep the person's identity, hairstyle and clothing exactly the same. Soft warm lighting. Professional portrait style.",
  },
  {
    key: "tranquila",
    prompt:
      "Transform this portrait to show the person looking serene and calm. Gentle soft smile, relaxed eyes, peaceful expression. Keep the person's identity, hairstyle and clothing exactly the same. Soft diffused natural lighting. Professional portrait style.",
  },
  {
    key: "neutra",
    prompt:
      "Transform this portrait to show the person with a completely neutral expression. Relaxed facial muscles, neutral mouth, steady calm gaze. Keep the person's identity, hairstyle and clothing exactly the same. Even flat studio lighting. Professional portrait style.",
  },
  {
    key: "desgastada",
    prompt:
      "Transform this portrait to show the person looking exhausted and worn out. Tired droopy eyes, slightly furrowed brow, tense jaw, faint under-eye circles. Keep the person's identity, hairstyle and clothing exactly the same. Slightly desaturated cool lighting. Professional portrait style.",
  },
  {
    key: "triste",
    prompt:
      "Transform this portrait to show the person looking deeply sad. Downturned mouth, watery glassy eyes, sorrowful expression, slightly lowered head. Keep the person's identity, hairstyle and clothing exactly the same. Cool blue-toned soft lighting. Professional portrait style.",
  },
  {
    key: "em_colapso",
    prompt:
      "Transform this portrait to show the person in extreme emotional distress. Wide frightened eyes, open mouth as if crying out, disheveled hair, tear streaks on cheeks, visible anguish. Keep the person's identity and clothing the same. Dramatic harsh contrasted lighting. Professional portrait style.",
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

  const body = {
    instances: [
      {
        prompt,
        referenceImages: [
          {
            referenceType: "REFERENCE_TYPE_RAW",
            referenceImage: {
              bytesBase64Encoded: baseImageB64,
            },
          },
        ],
      },
    ],
    parameters: {
      sampleCount: 1,
      outputOptions: {
        mimeType: "image/webp",
        compressionQuality: 85,
      },
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
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

    if (!saJson) {
      return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" }, 500);
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
    // Chunk-based base64 to avoid stack overflow on large images
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < avatarBytes.length; i += chunkSize) {
      const chunk = avatarBytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const baseImageB64 = btoa(binary);

    // 3. Get Google access token
    // Debug: log first chars of secret to diagnose encoding
    console.log("SA_JSON first 20 chars:", saJson.substring(0, 20));
    console.log("SA_JSON last 5 chars:", saJson.substring(saJson.length - 5));
    console.log("SA_JSON char codes [0..3]:", [...saJson.substring(0, 4)].map(c => c.charCodeAt(0)));
    
    // Strip wrapping quotes if secret was double-encoded
    let cleanSaJson = saJson.trim();
    // Try multiple levels of unwrapping
    while (cleanSaJson.startsWith('"') || cleanSaJson.startsWith("'")) {
      try {
        const unwrapped = JSON.parse(cleanSaJson);
        if (typeof unwrapped === "string") {
          cleanSaJson = unwrapped;
        } else {
          // It parsed into an object, use it directly
          break;
        }
      } catch {
        // Remove surrounding quotes manually
        cleanSaJson = cleanSaJson.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        break;
      }
    }
    const sa = typeof cleanSaJson === "string" ? JSON.parse(cleanSaJson) : cleanSaJson;
    const gcpProjectId = sa.project_id;
    const location = "us-central1";

    console.log("Getting Google access token for project:", gcpProjectId);
    const accessToken = await getGoogleAccessToken(
      cleanSaJson,
      "https://www.googleapis.com/auth/cloud-platform"
    );

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

        // Chunk-based decode to avoid stack overflow
        const rawBinary = atob(generatedB64);
        const imgBytes = new Uint8Array(rawBinary.length);
        for (let i = 0; i < rawBinary.length; i++) {
          imgBytes[i] = rawBinary.charCodeAt(i);
        }

        // Upload to storage
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

        // Get public URL
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
