import { supabase } from "@/integrations/supabase/client";

export type RilWindow = "30" | "90" | "120" | "365" | "1095" | "all";

export interface RilMetrics {
  computed_at: string;
  period_start: string;
  period_end: string;
  total_amostras: number;
  k_anonymity_min: number;
  distribuicao_risco: { moderado?: number; grave?: number; extremo?: number };
  tendencia_temporal: Record<string, unknown>;
  taxa_escalada: number | null;
  taxa_recorrencia: number | null;
  fatores_mais_comuns: Array<{ fator: string; count: number }>;
  taxa_atualizacao_fonar: number | null;
  correlacao_ampara_fonar: { convergencia?: number; divergencia?: number };
  indicador_subnotificacao: number | null;
  scope_value?: string | null;
}

export interface RilDashboard {
  window?: string;
  metrics: RilMetrics | null;
  serie_temporal: Array<{ day: string; total: number; urgente: number; grave: number }>;
  critical_events: Array<{
    event_type: string;
    severity: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;
  snapshots_amostra: Array<{
    computed_at: string;
    risco_ampara: string;
    risco_fonar: string;
    divergencia_entre_modelos: boolean;
    tendencia_risco: string;
    nivel_prioridade_intervencao: string;
    uf: string | null;
  }>;
}

const FN_API = "ril-api";
const FN_ENGINE = "ril-engine";

function buildUrl(fn: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}?${qs}`;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function fetchRilDashboardDirect(window: RilWindow = "30"): Promise<RilDashboard> {
  const res = await fetch(buildUrl(FN_API, { action: "dashboard", window }), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`RIL dashboard error: ${res.status}`);
  return await res.json();
}

export async function fetchRilReport(window: RilWindow = "30"): Promise<{ report: string; metrics: RilMetrics }> {
  const res = await fetch(buildUrl(FN_API, { action: "report", window }), {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`RIL report error: ${res.status}`);
  return await res.json();
}

export async function triggerRilConsolidate() {
  const res = await fetch(buildUrl(FN_ENGINE, { action: "consolidate" }), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ action: "consolidate" }),
  });
  return await res.json();
}

export async function recomputeMetricsForWindow(window: RilWindow) {
  const res = await fetch(buildUrl(FN_ENGINE, { action: "metrics", window }), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ action: "metrics", window }),
  });
  return await res.json();
}
