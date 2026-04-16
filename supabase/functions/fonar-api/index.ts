// FONAR API — endpoints isolados (não interfere no core)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TOTAL_STEPS = 8;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserIdFromSession(req: Request, supabase: any): Promise<string | null> {
  const token = req.headers.get("x-session-token") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    // Hash check against user_sessions
    const enc = new TextEncoder().encode(token);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    const { data } = await supabase
      .from("user_sessions")
      .select("user_id, expires_at, revoked_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!data || data.revoked_at || new Date(data.expires_at) < new Date()) return null;
    return data.user_id;
  } catch {
    return null;
  }
}

function calcRiskFromAnswers(respostas: Record<string, any>): { score: number; level: string; fatores: any } {
  let score = 0;
  const fatores: string[] = [];
  const inc = (n: number, label: string) => { score += n; if (n > 0) fatores.push(label); };

  // Step 2 — histórico de violência (cada tipo)
  const tipos = respostas.tipos_violencia || [];
  if (tipos.includes("fisica")) inc(15, "Violência física");
  if (tipos.includes("sexual")) inc(20, "Violência sexual");
  if (tipos.includes("psicologica")) inc(8, "Violência psicológica");
  if (tipos.includes("patrimonial")) inc(5, "Violência patrimonial");
  if (tipos.includes("moral")) inc(5, "Violência moral");

  // Step 3 — ameaças e armas
  if (respostas.tem_arma) inc(20, "Acesso a armas");
  if (respostas.ja_ameacou_morte) inc(20, "Ameaças de morte");
  if (respostas.ja_tentou_matar) inc(25, "Tentativa anterior de homicídio");

  // Step 4 — frequência
  if (respostas.frequencia === "diaria") inc(15, "Episódios diários");
  else if (respostas.frequencia === "semanal") inc(10, "Episódios semanais");

  // Step 5 — filhos
  if (respostas.tem_filhos && respostas.violencia_contra_filhos) inc(15, "Violência contra filhos");

  // Step 6 — isolamento
  if (respostas.sem_rede_apoio) inc(10, "Sem rede de apoio");

  let level = "sem_risco";
  if (score >= 60) level = "critico";
  else if (score >= 35) level = "alto";
  else if (score >= 15) level = "moderado";

  return { score: Math.min(100, score), level, fatores: { lista: fatores } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  try {
    // Public: status (UI checa flag)
    if (action === "status") {
      const { data } = await supabase.from("fonar_settings").select("chave, valor");
      const settings: Record<string, any> = {};
      for (const r of data || []) settings[r.chave] = r.valor;
      return json({ enabled: settings.enabled === true, settings });
    }

    const userId = await getUserIdFromSession(req, supabase);
    if (!userId) return json({ error: "unauthorized" }, 401);

    // Get current submission + risk + suggestions
    if (action === "overview") {
      const [subRes, riskRes, sugRes] = await Promise.all([
        supabase.from("fonar_submissions").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("fonar_risk_assessments").select("*").eq("user_id", userId).eq("latest", true).maybeSingle(),
        supabase.from("fonar_review_suggestions").select("*").eq("user_id", userId).eq("status", "pendente").order("created_at", { ascending: false }),
      ]);
      return json({
        submission: subRes.data,
        risk: riskRes.data,
        pending_suggestions: sugRes.data || [],
      });
    }

    if (action === "save_step" && req.method === "POST") {
      const body = await req.json();
      const step = Number(body.step);
      const respostas = body.respostas || {};
      if (!step || step < 1 || step > TOTAL_STEPS) return json({ error: "invalid_step" }, 400);

      const { data: existing } = await supabase
        .from("fonar_submissions").select("*").eq("user_id", userId).maybeSingle();

      const merged = { ...(existing?.respostas || {}), ...respostas };
      const nextStep = Math.max(existing?.current_step || 1, step + 1);

      if (existing) {
        await supabase.from("fonar_submissions").update({
          respostas: merged,
          current_step: Math.min(nextStep, TOTAL_STEPS),
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await supabase.from("fonar_submissions").insert({
          user_id: userId,
          respostas: merged,
          current_step: Math.min(nextStep, TOTAL_STEPS),
          total_steps: TOTAL_STEPS,
        });
      }
      return json({ ok: true, current_step: Math.min(nextStep, TOTAL_STEPS) });
    }

    if (action === "complete" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const origem = body.origem || "manual";
      const suggestionId = body.suggestion_id || null;

      const { data: sub } = await supabase.from("fonar_submissions").select("*").eq("user_id", userId).maybeSingle();
      if (!sub) return json({ error: "no_submission" }, 404);

      // Determine next version
      const { data: lastVer } = await supabase
        .from("fonar_versions").select("versao").eq("user_id", userId)
        .order("versao", { ascending: false }).limit(1).maybeSingle();
      const nextVersao = (lastVer?.versao || 0) + 1;

      const { data: version } = await supabase.from("fonar_versions").insert({
        submission_id: sub.id,
        user_id: userId,
        versao: nextVersao,
        respostas: sub.respostas,
        origem,
        suggestion_id: suggestionId,
      }).select().single();

      await supabase.from("fonar_submissions").update({
        status: "concluido",
        current_version_id: version.id,
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);

      // Compute risk
      const risk = calcRiskFromAnswers(sub.respostas);
      await supabase.from("fonar_risk_assessments").update({ latest: false }).eq("user_id", userId).eq("latest", true);
      await supabase.from("fonar_risk_assessments").insert({
        user_id: userId,
        version_id: version.id,
        risk_score: risk.score,
        risk_level: risk.level,
        fatores: risk.fatores,
        latest: true,
      });

      // Resolve suggestion if any
      if (suggestionId) {
        await supabase.from("fonar_review_suggestions").update({
          status: "revisada",
          acted_at: new Date().toISOString(),
          acted_action: "revisada_completa",
        }).eq("id", suggestionId).eq("user_id", userId);
      }

      await supabase.from("fonar_logs").insert({
        user_id: userId, level: "info", message: "fonar_version_created",
        context: { versao: nextVersao, risk_level: risk.level }
      });

      return json({ ok: true, version_id: version.id, risk });
    }

    if (action === "ignore_suggestion" && req.method === "POST") {
      const body = await req.json();
      await supabase.from("fonar_review_suggestions").update({
        status: "ignorada",
        acted_at: new Date().toISOString(),
        acted_action: "ignorada",
      }).eq("id", body.suggestion_id).eq("user_id", userId);
      return json({ ok: true });
    }

    if (action === "history") {
      const { data } = await supabase.from("fonar_versions")
        .select("*").eq("user_id", userId).order("versao", { ascending: false });
      return json({ versions: data || [] });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[fonar-api] error", err);
    return json({ error: String(err) }, 500);
  }
});
