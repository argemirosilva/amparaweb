import { supabase } from "@/integrations/supabase/client";

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
}

export interface RilDashboard {
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

export async function fetchRilDashboard(): Promise<RilDashboard> {
  const { data, error } = await supabase.functions.invoke(FN_API, {
    method: "GET",
    body: null,
    headers: {},
  });
  // Fallback caso invoke não suporte query params
  if (error || !data) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN_API}?action=dashboard`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    return await res.json();
  }
  return data as RilDashboard;
}

export async function fetchRilDashboardDirect(): Promise<RilDashboard> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN_API}?action=dashboard`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!res.ok) throw new Error(`RIL dashboard error: ${res.status}`);
  return await res.json();
}

export async function fetchRilReport(): Promise<{ report: string; metrics: RilMetrics }> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN_API}?action=report`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!res.ok) throw new Error(`RIL report error: ${res.status}`);
  return await res.json();
}

export async function triggerRilConsolidate() {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FN_ENGINE}?action=consolidate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "consolidate" }),
  });
  return await res.json();
}
