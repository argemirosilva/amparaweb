// AMPARA Campo - Edge function pública para forças de segurança
// Reutiliza dados existentes (RIL, FONAR, gravacoes_analises) e transforma em tags simples

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ================== Helpers ==================

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function onlyDigits(v: string) {
  return (v || "").replace(/\D/g, "");
}

function normalize(v: string) {
  return (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function logAccess(params: {
  vitima_id?: string | null;
  query_type: string;
  query_value?: string;
  found: boolean;
  agente_identificacao?: string;
  agente_orgao?: string;
  ip_address?: string;
  user_agent?: string;
}) {
  const hash = params.query_value ? await sha256Hex(params.query_value) : null;
  await supabase.from("campo_access_logs").insert({
    vitima_id: params.vitima_id ?? null,
    query_type: params.query_type,
    query_value_hash: hash,
    found: params.found,
    agente_identificacao: params.agente_identificacao ?? null,
    agente_orgao: params.agente_orgao ?? null,
    ip_address: params.ip_address ?? null,
    user_agent: params.user_agent ?? null,
  });
}

// ================== Busca de vítima ==================

async function buscarVitima(query: string) {
  const digits = onlyDigits(query);
  const trimmed = (query || "").trim();
  const isMostlyDigits = digits.length >= 8 && digits.length / Math.max(trimmed.length, 1) > 0.6;

  let q = supabase.from("usuarios").select("id, nome, cpf, telefone, criado_em").limit(20);

  if (digits.length === 11 && isMostlyDigits) {
    // CPF completo OU celular completo
    q = q.or(`cpf.eq.${digits},telefone.ilike.%${digits.slice(-9)}%`);
  } else if (digits.length >= 10 && isMostlyDigits) {
    // Telefone (com ou sem DDD)
    q = q.ilike("telefone", `%${digits.slice(-9)}%`);
  } else if (digits.length >= 4 && isMostlyDigits) {
    // CPF parcial (últimos dígitos) ou telefone parcial
    q = q.or(`cpf.ilike.%${digits}%,telefone.ilike.%${digits}%`);
  } else if (trimmed.length >= 3) {
    // Busca por nome — case-insensitive direto via ilike (Postgres ilike ignora caixa, mas não acentos).
    // Usamos o termo bruto para preservar acentuação no banco.
    q = q.ilike("nome", `%${trimmed}%`);
  } else {
    return [];
  }

  const { data, error } = await q;
  if (error) {
    console.error("[campo-api] buscarVitima error", error);
    return [];
  }

  // Fallback adicional: se busca por nome não retornou nada, tenta versão sem acentos
  if ((data?.length ?? 0) === 0 && !isMostlyDigits && trimmed.length >= 3) {
    const norm = normalize(trimmed);
    const { data: data2 } = await supabase
      .from("usuarios")
      .select("id, nome, cpf, telefone, criado_em")
      .ilike("nome", `%${norm}%`)
      .limit(20);
    return data2 ?? [];
  }

  return data ?? [];
}

// ================== Geração de Tags ==================

type TagBundle = {
  nivel_risco: "baixo" | "moderado" | "alto" | "critico";
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
};

function mapRiskLevel(level?: string | null): "baixo" | "moderado" | "alto" | "critico" {
  const l = (level ?? "").toLowerCase();
  if (l === "critico" || l === "extremo") return "critico";
  if (l === "alto" || l === "grave") return "alto";
  if (l === "moderado" || l === "medio") return "moderado";
  return "baixo";
}

async function gerarIndicadores(vitimaId: string): Promise<TagBundle> {
  const tags = new Set<string>();
  const agora = new Date();
  const d30 = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const d90 = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Snapshot RIL mais recente
  const { data: snapshot } = await supabase
    .from("risk_context_snapshots")
    .select("*")
    .eq("user_id", vitimaId)
    .eq("latest", true)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Análises micro recentes (últimos 90d)
  const { data: micros } = await supabase
    .from("analysis_micro_results")
    .select("risk_level, context_classification, output_json, created_at")
    .eq("user_id", vitimaId)
    .gte("created_at", d90)
    .order("created_at", { ascending: false })
    .limit(50);

  // 3. Análises legacy
  const { data: legacy } = await supabase
    .from("gravacoes_analises")
    .select("nivel_risco, categorias, palavras_chave, created_at")
    .eq("user_id", vitimaId)
    .gte("created_at", d90)
    .order("created_at", { ascending: false })
    .limit(50);

  // 4. Pânicos recentes
  const { data: panicos30 } = await supabase
    .from("alertas_panico")
    .select("id, criado_em, status")
    .eq("user_id", vitimaId)
    .gte("criado_em", d30);

  // 5. FONAR risco
  const { data: fonar } = await supabase
    .from("fonar_risk_assessments")
    .select("risk_level, fatores, computed_at")
    .eq("user_id", vitimaId)
    .eq("latest", true)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 6. Total histórico
  const { count: totalGravacoes } = await supabase
    .from("gravacoes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", vitimaId);

  // ===== Determina nível de risco final =====
  const riscoAmpara = snapshot?.risco_ampara ?? micros?.[0]?.risk_level ?? legacy?.[0]?.nivel_risco ?? null;
  const riscoFonar = snapshot?.risco_fonar ?? fonar?.risk_level ?? null;

  // Pega o pior dos dois
  const niveisOrdem = ["baixo", "moderado", "alto", "critico"];
  const ampLevel = mapRiskLevel(riscoAmpara);
  const fonLevel = mapRiskLevel(riscoFonar);
  const nivelFinal = (niveisOrdem.indexOf(ampLevel) >= niveisOrdem.indexOf(fonLevel) ? ampLevel : fonLevel) as TagBundle["nivel_risco"];

  // Tag de risco
  tags.add(`risco_${nivelFinal}`);

  // ===== Dinâmica =====
  const microsCount = micros?.length ?? 0;
  const legacyCount = legacy?.length ?? 0;
  const totalRecentes = microsCount + legacyCount;

  if (totalRecentes >= 5) tags.add("recorrente");
  if (totalRecentes >= 1 && totalRecentes < 5) tags.add("conflito_pontual");

  if (snapshot?.tendencia_risco === "subindo" || snapshot?.divergencia_entre_modelos) {
    tags.add("escalada_recente");
  }

  if ((totalGravacoes ?? 0) >= 10) tags.add("historico_previo");

  // ===== Comportamento (extraído de palavras_chave / categorias / output_json) =====
  const allKeywords = new Set<string>();
  legacy?.forEach((l: any) => {
    (l.palavras_chave ?? []).forEach((k: string) => allKeywords.add(normalize(k)));
    (l.categorias ?? []).forEach((c: string) => allKeywords.add(normalize(c)));
  });
  micros?.forEach((m: any) => {
    const out = m.output_json ?? {};
    (out.palavras_chave ?? out.keywords ?? []).forEach((k: string) => allKeywords.add(normalize(k)));
    (out.categorias ?? []).forEach((c: string) => allKeywords.add(normalize(c)));
    (out.indicadores ?? []).forEach((c: string) => allKeywords.add(normalize(c)));
  });

  const kwArr = Array.from(allKeywords).join(" ");
  if (/(amea[cç]a|matar|destruir|acabar)/i.test(kwArr)) tags.add("indicador_ameaca");
  if (/(intimida|humilha|ofen|xinga)/i.test(kwArr)) tags.add("indicador_intimidacao");
  if (/(controle|controlar|proibir|vigia|monitorar)/i.test(kwArr)) tags.add("indicador_controle");
  if (/(coer[cç][aã]o|chantagem|press[aã]o)/i.test(kwArr)) tags.add("indicador_coercao");
  if (/(agress|empurr|bater|soco|tapa|viol[eê]ncia f[ií]sica)/i.test(kwArr)) tags.add("indicador_agressividade");

  // ===== Contexto (FONAR) =====
  const fatoresFonar = (fonar?.fatores ?? {}) as Record<string, any>;
  if (fatoresFonar.dependencia_financeira || fatoresFonar.dependencia_economica) tags.add("dependencia_financeira");
  if (fatoresFonar.tem_filhos || fatoresFonar.presenca_filhos || fatoresFonar.filhos_em_casa) tags.add("presenca_filhos");
  if (fatoresFonar.coabitacao || fatoresFonar.convivencia_local || fatoresFonar.mora_junto) tags.add("convivencia_local");
  if (fatoresFonar.isolamento_social || fatoresFonar.isolamento) tags.add("isolamento_social");
  if (nivelFinal === "alto" || nivelFinal === "critico") {
    if ((panicos30?.length ?? 0) > 0 || tags.has("indicador_ameaca")) {
      tags.add("alta_vulnerabilidade");
    }
  }

  // ===== Consistência =====
  if (snapshot?.divergencia_entre_modelos) {
    tags.add("padrao_nao_identificado");
  } else if (totalRecentes >= 3 && (totalGravacoes ?? 0) >= 5) {
    tags.add("consistente_com_historico");
  } else if ((totalGravacoes ?? 0) === 0 && !fonar) {
    tags.add("sem_historico_relevante");
    tags.add("indicadores_limitados");
  } else if (totalRecentes < 2) {
    tags.add("indicadores_limitados");
  }

  // ===== Alerta operacional =====
  let alerta = "";
  switch (nivelFinal) {
    case "critico":
      alerta = "Contexto de risco crítico. Recomenda-se abordagem imediata, isolamento da vítima e acionamento de equipe de apoio.";
      break;
    case "alto":
      alerta = "Contexto com potencial de agravamento. Recomenda-se abordagem cautelosa e separação das partes.";
      break;
    case "moderado":
      alerta = "Histórico relevante identificado. Documente o atendimento e acompanhe sinais de escalada.";
      break;
    default:
      alerta = "Sem indicadores expressivos no momento. Mantenha procedimento padrão e registre o atendimento.";
  }

  return {
    nivel_risco: nivelFinal,
    tags: Array.from(tags),
    alerta_operacional: alerta,
    ultima_atualizacao: snapshot?.computed_at ?? micros?.[0]?.created_at ?? legacy?.[0]?.created_at ?? null,
    resumo_indicadores: {
      total_gravacoes: totalGravacoes ?? 0,
      panicos_30d: panicos30?.length ?? 0,
      risco_ampara: riscoAmpara,
      risco_fonar: riscoFonar,
      divergencia: snapshot?.divergencia_entre_modelos ?? false,
    },
  };
}

// ================== Handler ==================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "";
  const ua = req.headers.get("user-agent") ?? "";

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // -------- Buscar vítima --------
    if (action === "buscarVitima") {
      const query = String(body.query ?? "").trim();
      const agente = String(body.agente_identificacao ?? "").trim();
      const orgao = String(body.agente_orgao ?? "").trim();

      if (!query || query.length < 3) {
        return new Response(JSON.stringify({ error: "Termo de busca muito curto." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!agente) {
        return new Response(JSON.stringify({ error: "Identificação do agente é obrigatória." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resultados = await buscarVitima(query);
      const tipo = onlyDigits(query).length === 11 ? "busca_cpf" : onlyDigits(query).length >= 10 ? "busca_telefone" : "busca_nome";

      await logAccess({
        query_type: tipo,
        query_value: query,
        found: resultados.length > 0,
        agente_identificacao: agente,
        agente_orgao: orgao,
        ip_address: ip,
        user_agent: ua,
      });

      // Mascarar dados retornados
      const masked = resultados.map((r: any) => ({
        id: r.id,
        nome_mascarado: maskName(r.nome),
        telefone_mascarado: maskPhone(r.telefone),
        cadastrada_desde: r.criado_em,
      }));

      return new Response(JSON.stringify({ resultados: masked }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- Consultar indicadores --------
    if (action === "consultarIndicadores") {
      const vitimaId = String(body.vitima_id ?? "");
      const agente = String(body.agente_identificacao ?? "").trim();
      const orgao = String(body.agente_orgao ?? "").trim();

      if (!vitimaId || !agente) {
        return new Response(JSON.stringify({ error: "vitima_id e agente_identificacao são obrigatórios." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const indicadores = await gerarIndicadores(vitimaId);

      await logAccess({
        vitima_id: vitimaId,
        query_type: "consulta_indicadores",
        found: true,
        agente_identificacao: agente,
        agente_orgao: orgao,
        ip_address: ip,
        user_agent: ua,
      });

      return new Response(JSON.stringify(indicadores), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- Registrar ocorrência --------
    if (action === "registrarOcorrencia") {
      const vitimaId = String(body.vitima_id ?? "");
      const agente = String(body.agente_identificacao ?? "").trim();
      const orgao = String(body.agente_orgao ?? "").trim();

      if (!vitimaId || !agente || !body.situacao) {
        return new Response(JSON.stringify({ error: "vitima_id, agente_identificacao e situacao são obrigatórios." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Snapshot dos indicadores no momento do registro
      const indicadores = await gerarIndicadores(vitimaId);

      const { data: ocorrencia, error } = await supabase
        .from("ocorrencias_campo")
        .insert({
          vitima_id: vitimaId,
          situacao: body.situacao,
          comportamento_requerido: body.comportamento_requerido ?? null,
          estado_vitima: body.estado_vitima ?? null,
          contexto: Array.isArray(body.contexto) ? body.contexto : [],
          observacao: body.observacao ? String(body.observacao).slice(0, 300) : null,
          agente_identificacao: agente,
          agente_orgao: orgao || null,
          protocolo_externo: body.protocolo_externo ?? null,
          latitude: typeof body.latitude === "number" ? body.latitude : null,
          longitude: typeof body.longitude === "number" ? body.longitude : null,
          nivel_risco_snapshot: indicadores.nivel_risco,
          tags_snapshot: indicadores.tags,
          ip_address: ip,
          user_agent: ua,
        })
        .select("id, created_at")
        .single();

      if (error) {
        console.error("[campo-api] insert ocorrencia error", error);
        return new Response(JSON.stringify({ error: "Falha ao registrar ocorrência." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await logAccess({
        vitima_id: vitimaId,
        query_type: "registro_ocorrencia",
        found: true,
        agente_identificacao: agente,
        agente_orgao: orgao,
        ip_address: ip,
        user_agent: ua,
      });

      // Dispara sinal para o RIL recalcular (não-bloqueante)
      try {
        await supabase.from("ril_events").insert({
          user_id: vitimaId,
          event_type: "campo_ocorrencia_registrada",
          severity: indicadores.nivel_risco === "critico" || indicadores.nivel_risco === "alto" ? "critical" : "info",
          payload: {
            source: "ampara_campo",
            ocorrencia_id: ocorrencia.id,
            situacao: body.situacao,
            tags: indicadores.tags,
          },
        });
      } catch (e) {
        console.warn("[campo-api] ril_events insert failed (não bloqueante)", e);
      }

      return new Response(JSON.stringify({ ok: true, ocorrencia_id: ocorrencia.id, criado_em: ocorrencia.created_at }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- Auditoria (admin) --------
    if (action === "listarAuditoria") {
      // Lista logs e ocorrências para o painel admin
      const limit = Math.min(Number(body.limit ?? 100), 500);
      const [{ data: logs }, { data: ocorrencias }] = await Promise.all([
        supabase
          .from("campo_access_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("ocorrencias_campo")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      return new Response(JSON.stringify({ logs: logs ?? [], ocorrencias: ocorrencias ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[campo-api] fatal", e);
    return new Response(JSON.stringify({ error: e.message ?? "Erro interno." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function maskName(nome: string | null): string {
  if (!nome) return "—";
  return nome
    .split(" ")
    .map((p, i) => (i === 0 ? p : p.length > 1 ? p[0] + "." : p))
    .join(" ");
}

function maskPhone(tel: string | null): string {
  if (!tel) return "—";
  const d = onlyDigits(tel);
  if (d.length < 4) return "****";
  return "(**) ****-" + d.slice(-4);
}
