import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Profile = "escalada" | "decaida" | "pico" | "constante";

function assignProfile(): Profile {
  const r = Math.random();
  if (r < 0.30) return "escalada";
  if (r < 0.55) return "decaida";
  if (r < 0.80) return "pico";
  return "constante";
}

/** Returns days-ago (0 = today, 90 = 90 days ago) based on profile */
function daysAgoForProfile(profile: Profile, idx: number, total: number): number {
  const t = total > 1 ? idx / (total - 1) : 0.5; // 0..1 progression

  switch (profile) {
    case "escalada":
      // Concentrated in recent days (low days-ago). t=0 → ~80 days ago, t=1 → ~0 days ago
      return Math.round((1 - Math.pow(t, 2)) * 85 + Math.random() * 5);

    case "decaida":
      // Concentrated early (high days-ago). t=0 → ~0 days ago, t=1 → ~85 days ago
      return Math.round(Math.pow(t, 2) * 85 + Math.random() * 5);

    case "pico":
      // Cluster between day 30-50 ago, with some scatter
      if (t < 0.15 || t > 0.85) {
        // Sparse edges
        return Math.round(Math.random() * 90);
      }
      return Math.round(30 + Math.random() * 20);

    case "constante":
      return Math.round(Math.random() * 90);
  }
}

/** Generate a realistic hour with nighttime bias */
function generateHour(): number {
  const r = Math.random();
  if (r < 0.60) return 19 + Math.floor(Math.random() * 5); // 19-23
  if (r < 0.85) return 12 + Math.floor(Math.random() * 7); // 12-18
  return 6 + Math.floor(Math.random() * 6); // 06-11
}

function generateTimestamp(daysAgo: number): Date {
  const now = new Date();
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  date.setHours(generateHour(), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
  return date;
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

    const body = await req.json();
    const { session_token, dry_run } = body;

    if (!session_token) return json({ error: "session_token obrigatório" }, 401);

    // Authenticate admin
    const tokenHash = await hashToken(session_token);
    const { data: session } = await supabase
      .from("user_sessions")
      .select("user_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (!session || new Date(session.expires_at) < new Date()) {
      return json({ error: "Sessão inválida ou expirada" }, 401);
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user_id);

    const isAdmin = (roles || []).some((r: any) => r.role === "admin_master" || r.role === "admin_tenant");
    if (!isAdmin) return json({ error: "Acesso negado" }, 403);

    // Fetch all recordings
    const { data: gravacoes, error: gErr } = await supabase
      .from("gravacoes")
      .select("id, user_id, created_at")
      .order("created_at", { ascending: true });

    if (gErr) return json({ error: gErr.message }, 500);

    // Fetch all analyses
    const { data: analises, error: aErr } = await supabase
      .from("gravacoes_analises")
      .select("id, gravacao_id, created_at");

    if (aErr) return json({ error: aErr.message }, 500);

    // Group recordings by user
    const byUser: Record<string, typeof gravacoes> = {};
    for (const g of gravacoes || []) {
      if (!byUser[g.user_id]) byUser[g.user_id] = [];
      byUser[g.user_id].push(g);
    }

    // Build analysis lookup: gravacao_id -> analysis ids
    const analisesByGravacao: Record<string, string[]> = {};
    for (const a of analises || []) {
      if (!analisesByGravacao[a.gravacao_id]) analisesByGravacao[a.gravacao_id] = [];
      analisesByGravacao[a.gravacao_id].push(a.id);
    }

    const userIds = Object.keys(byUser);
    const profileAssignments: Record<string, Profile> = {};
    const summary = { escalada: 0, decaida: 0, pico: 0, constante: 0, total_users: userIds.length, total_gravacoes: (gravacoes || []).length, total_analises: (analises || []).length };

    // Assign profiles
    for (const uid of userIds) {
      const profile = assignProfile();
      profileAssignments[uid] = profile;
      summary[profile]++;
    }

    if (dry_run) {
      // Preview distribution
      const preview: any[] = [];
      for (const uid of userIds) {
        const profile = profileAssignments[uid];
        const recs = byUser[uid];
        const dates = recs.map((_, i) => {
          const da = daysAgoForProfile(profile, i, recs.length);
          return { days_ago: da };
        });
        preview.push({ user_id: uid, profile, count: recs.length, sample_days_ago: dates.slice(0, 5) });
      }
      return json({ dry_run: true, summary, preview: preview.slice(0, 10) });
    }

    // Execute updates in batches
    let updatedGravacoes = 0;
    let updatedAnalises = 0;

    for (const uid of userIds) {
      const profile = profileAssignments[uid];
      const recs = byUser[uid];

      for (let i = 0; i < recs.length; i++) {
        const daysAgo = daysAgoForProfile(profile, i, recs.length);
        const newCreatedAt = generateTimestamp(daysAgo);
        const newUpdatedAt = new Date(newCreatedAt.getTime() + Math.floor(Math.random() * 5) * 60 * 1000);

        const { error: uErr } = await supabase
          .from("gravacoes")
          .update({ created_at: newCreatedAt.toISOString(), updated_at: newUpdatedAt.toISOString() })
          .eq("id", recs[i].id);

        if (!uErr) updatedGravacoes++;

        // Update corresponding analyses
        const aIds = analisesByGravacao[recs[i].id] || [];
        for (const aId of aIds) {
          const analiseCreatedAt = new Date(newCreatedAt.getTime() + Math.floor(Math.random() * 10) * 60 * 1000);
          const { error: aaErr } = await supabase
            .from("gravacoes_analises")
            .update({ created_at: analiseCreatedAt.toISOString() })
            .eq("id", aId);
          if (!aaErr) updatedAnalises++;
        }
      }
    }

    return json({
      success: true,
      summary,
      updated: { gravacoes: updatedGravacoes, analises: updatedAnalises },
    });
  } catch (err) {
    return json({ error: err.message || "Erro interno" }, 500);
  }
});
