const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function callCampoApi(action: string, params: Record<string, any> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/campo-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export type NivelRiscoCampo = "baixo" | "moderado" | "alto" | "critico";

export interface VitimaResultado {
  id: string;
  nome_mascarado: string;
  telefone_mascarado: string;
  cadastrada_desde: string;
}

export interface IndicadoresCampo {
  nivel_risco: NivelRiscoCampo;
  tags: string[];
  alerta_operacional: string;
  ultima_atualizacao: string | null;
  resumo_indicadores: {
    total_gravacoes: number;
    panicos_30d: number;
    risco_ampara: string | null;
    risco_fonar: string | null;
    divergencia: boolean;
  };
}

export interface OcorrenciaCampoInput {
  vitima_id: string;
  agente_identificacao: string;
  agente_orgao?: string;
  protocolo_externo?: string;
  situacao: "ocorrencia_confirmada" | "sem_evidencia_no_local" | "conflito_verbal" | "violencia_fisica";
  comportamento_requerido?: "comportamento_agressivo" | "comportamento_intimidatorio" | "comportamento_colaborativo";
  estado_vitima?: "vitima_com_medo" | "vitima_retraida" | "vitima_estavel";
  contexto?: string[];
  observacao?: string;
  latitude?: number;
  longitude?: number;
}
