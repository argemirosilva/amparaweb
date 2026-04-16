// FONAR Worker — consome fila fonar_signals
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function classifyRelevance(signal: any): "baixa" | "media" | "alta" | "critica" {
  const ns = signal.event_namespace;
  const p = signal.payload || {};
  if (ns === "fonar_panico") return "critica";
  if (ns === "fonar_micro") {
    if (p.risk_level === "critico") return "critica";
    if (p.risk_level === "alto") return "alta";
    if (p.cycle_phase && p.cycle_phase !== "nao_identificado") return "media";
    return "baixa";
  }
  if (ns === "fonar_macro") return "media";
  return "baixa";
}

function buildSuggestion(signal: any, relevance: string): { titulo: string; motivo: string; campos: string[] } | null {
  const ns = signal.event_namespace;
  const p = signal.payload || {};

  if (ns === "fonar_panico") {
    return {
      titulo: "Revisar FONAR após acionamento de pânico",
      motivo: "Foi registrado um acionamento de emergência. Talvez seja hora de revisar a avaliação de risco do FONAR.",
      campos: ["tipos_violencia", "ja_ameacou_morte", "frequencia"],
    };
  }
  if (ns === "fonar_micro") {
    if (p.risk_level === "critico" || p.risk_level === "alto") {
      return {
        titulo: "Análise recente indicou risco " + p.risk_level,
        motivo: "A AMPARA detectou um risco elevado em uma análise recente. Revisar o FONAR pode trazer um retrato mais preciso.",
        campos: ["tipos_violencia", "frequencia", "tem_arma"],
      };
    }
    if (p.cycle_phase && p.cycle_phase !== "nao_identificado") {
      return {
        titulo: "Mudança de padrão detectada",
        motivo: "O ciclo de violência mudou para fase '" + p.cycle_phase + "'. Pode valer revisar o FONAR.",
        campos: ["frequencia"],
      };
    }
  }
  if (ns === "fonar_macro" && relevance !== "baixa") {
    return {
      titulo: "Novo relatório macro disponível",
      motivo: "A AMPARA gerou um relatório de período. Considere revisar o FONAR.",
      campos: [],
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Check enabled
  const { data: settings } = await supabase.from("fonar_settings").select("chave, valor");
  const map: Record<string, any> = {};
  for (const r of settings || []) map[r.chave] = r.valor;
  if (map.enabled !== true) {
    return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const batchSize = Number(map.worker_batch_size) || 50;

  // Pull queued signals
  const { data: signals, error } = await supabase
    .from("fonar_signals")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let processed = 0;
  let suggestionsCreated = 0;

  for (const sig of signals || []) {
    try {
      const relevance = classifyRelevance(sig);

      // Only create suggestion if user has a submission already
      const { data: sub } = await supabase
        .from("fonar_submissions").select("id").eq("user_id", sig.user_id).maybeSingle();

      if (sub && (relevance === "media" || relevance === "alta" || relevance === "critica")) {
        const built = buildSuggestion(sig, relevance);
        if (built) {
          await supabase.from("fonar_review_suggestions").insert({
            user_id: sig.user_id,
            signal_id: sig.id,
            titulo: built.titulo,
            motivo: built.motivo,
            campos_sugeridos: built.campos,
            relevance,
          });
          suggestionsCreated++;
        }
      }

      await supabase.from("fonar_signals").update({
        status: "processed",
        relevance,
        processed_at: new Date().toISOString(),
      }).eq("id", sig.id);
      processed++;
    } catch (e) {
      await supabase.from("fonar_signals").update({
        status: "error",
        error_message: String(e),
        processed_at: new Date().toISOString(),
      }).eq("id", sig.id);
    }
  }

  await supabase.from("fonar_logs").insert({
    level: "info", message: "worker_run",
    context: { processed, suggestions_created: suggestionsCreated }
  });

  return new Response(JSON.stringify({ processed, suggestions_created: suggestionsCreated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
