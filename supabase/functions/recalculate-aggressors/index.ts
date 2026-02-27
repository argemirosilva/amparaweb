import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Same logic as recalculateAgressorRisk in web-api
async function recalculateAgressorRisk(supabase: any, agressorId: string) {
  const { data: incidents } = await supabase
    .from("aggressor_incidents")
    .select("violence_types, severity, occurred_at_month, pattern_tags, confidence")
    .eq("aggressor_id", agressorId)
    .order("occurred_at_month", { ascending: false });

  if (!incidents || incidents.length === 0) {
    await supabase.from("agressores").update({
      risk_score: 0, risk_level: "baixo",
      violence_profile_probs: {}, flags: [],
    }).eq("id", agressorId);
    return;
  }

  const typeCounts: Record<string, { count: number; totalSev: number; recent: boolean }> = {};
  const now = new Date();
  let maxSeverity = 0;
  let recentHighSeverity = false;
  const patternSet = new Set<string>();

  for (const inc of incidents) {
    const monthDiff = inc.occurred_at_month
      ? (now.getFullYear() * 12 + now.getMonth()) -
        (parseInt(inc.occurred_at_month.split("-")[0]) * 12 +
          parseInt(inc.occurred_at_month.split("-")[1]) - 1)
      : 12;
    const isRecent = monthDiff <= 6;
    for (const vt of inc.violence_types || []) {
      if (!typeCounts[vt]) typeCounts[vt] = { count: 0, totalSev: 0, recent: false };
      typeCounts[vt].count++;
      typeCounts[vt].totalSev += inc.severity || 3;
      if (isRecent) typeCounts[vt].recent = true;
    }
    if (inc.severity > maxSeverity) maxSeverity = inc.severity;
    if (isRecent && inc.severity >= 4) recentHighSeverity = true;
    for (const pt of inc.pattern_tags || []) patternSet.add(pt);
  }

  const totalIncidents = incidents.length;
  const violenceProbs: Record<string, number> = {};
  for (const [type, data] of Object.entries(typeCounts)) {
    const d = data as { count: number; totalSev: number; recent: boolean };
    const freq = d.count / totalIncidents;
    const sevFactor = d.totalSev / (d.count * 5);
    const recencyBoost = d.recent ? 1.3 : 0.8;
    violenceProbs[type] = Math.min(99, Math.round(freq * sevFactor * recencyBoost * 100));
  }

  let riskScore = Math.min(100, totalIncidents * 8 + maxSeverity * 10);
  if (recentHighSeverity) riskScore = Math.min(100, riskScore + 20);
  if (patternSet.has("perseguicao") || patternSet.has("stalking")) riskScore = Math.min(100, riskScore + 15);
  if (patternSet.has("ameaca")) riskScore = Math.min(100, riskScore + 10);

  const riskLevel = riskScore >= 80 ? "critico" : riskScore >= 55 ? "alto" : riskScore >= 30 ? "medio" : "baixo";

  const flags: string[] = [];
  if (totalIncidents >= 3) flags.push("reincidente");
  if (recentHighSeverity) flags.push("escalada");
  if (patternSet.has("perseguicao") || patternSet.has("stalking")) flags.push("stalking");
  if (totalIncidents > 1) flags.push("multi-relatos");

  const lastIncident = incidents[0]?.occurred_at_month
    ? new Date(incidents[0].occurred_at_month + "-01").toISOString()
    : null;

  await supabase.from("agressores").update({
    risk_score: riskScore, risk_level: riskLevel,
    violence_profile_probs: violenceProbs, flags,
    last_incident_at: lastIncident,
  }).eq("id", agressorId);
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

    // Get all distinct aggressor IDs that have incidents
    const { data: aggressorRows, error: fetchErr } = await supabase
      .from("aggressor_incidents")
      .select("aggressor_id")
      .limit(5000);

    if (fetchErr) throw fetchErr;

    const uniqueIds = [...new Set((aggressorRows || []).map((r: any) => r.aggressor_id))];
    const total = uniqueIds.length;
    let updated = 0;
    let errors = 0;

    for (const id of uniqueIds) {
      try {
        await recalculateAgressorRisk(supabase, id as string);
        updated++;
      } catch (e) {
        console.error(`Error recalculating ${id}:`, e);
        errors++;
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action_type: "recalculate_aggressors_cron",
      success: errors === 0,
      details: { total, updated, errors },
    });

    return new Response(
      JSON.stringify({ ok: true, total, updated, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("recalculate-aggressors error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
