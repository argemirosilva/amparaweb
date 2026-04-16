import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fonar-api`;

function getSessionToken(): string | null {
  return localStorage.getItem("ampara_session_token");
}

async function call(action: string, method: "GET" | "POST" = "GET", body?: any) {
  const token = getSessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-session-token"] = token;

  const res = await fetch(`${FN_URL}?action=${action}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "request_failed" }));
    throw new Error(err.error || "request_failed");
  }
  return res.json();
}

export const fonarService = {
  status: () => call("status"),
  overview: () => call("overview"),
  saveStep: (step: number, respostas: Record<string, any>) =>
    call("save_step", "POST", { step, respostas }),
  complete: (origem: "manual" | "sugestao_revisao" | "onboarding" = "manual", suggestionId?: string) =>
    call("complete", "POST", { origem, suggestion_id: suggestionId }),
  ignoreSuggestion: (suggestionId: string) =>
    call("ignore_suggestion", "POST", { suggestion_id: suggestionId }),
  history: () => call("history"),
};

export type FonarRiskLevel = "sem_risco" | "moderado" | "alto" | "critico";

export interface FonarOverview {
  submission: any | null;
  risk: {
    risk_score: number;
    risk_level: FonarRiskLevel;
    fatores: { lista?: string[] };
    computed_at: string;
  } | null;
  pending_suggestions: Array<{
    id: string;
    titulo: string;
    motivo: string;
    relevance: "baixa" | "media" | "alta" | "critica";
    campos_sugeridos: string[];
    created_at: string;
  }>;
}
