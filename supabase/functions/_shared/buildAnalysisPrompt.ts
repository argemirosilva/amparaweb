/**
 * Shared utility: builds the AI analysis prompt dynamically
 * from the `tipos_alerta` table, ensuring prompt values always
 * match the database codes.
 *
 * Priority: admin_settings override > dynamic template.
 */

interface TipoAlerta {
  grupo: string;
  codigo: string;
  label: string;
}

export async function buildAnalysisPrompt(supabase: any): Promise<string> {
  // 1. Check for admin override (retrocompat)
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("valor")
      .eq("chave", "ia_prompt_analise")
      .maybeSingle();
    if (data?.valor?.trim()) return data.valor.trim();
  } catch { /* fall through to dynamic */ }

  // 2. Fetch active alert types from DB
  let tipos: TipoAlerta[] = [];
  try {
    const { data } = await supabase
      .from("tipos_alerta")
      .select("grupo, codigo, label")
      .eq("ativo", true)
      .order("grupo")
      .order("ordem");
    tipos = (data || []) as TipoAlerta[];
  } catch { /* use hardcoded fallback */ }

  // 3. Group by grupo
  const byGroup = (g: string) => tipos.filter((t) => t.grupo === g).map((t) => t.codigo);

  const violencia = byGroup("violencia");
  const taticas = byGroup("tatica");
  const risco = byGroup("risco");
  const contexto = byGroup("contexto");
  const ciclo = byGroup("ciclo");

  // Fallbacks if table is empty or missing groups
  const tiposViolencia = violencia.length > 0
    ? violencia.join("|")
    : "violencia_fisica|violencia_psicologica|violencia_moral|violencia_patrimonial|violencia_sexual|nenhuma";

  const tiposTaticas = taticas.length > 0
    ? taticas.join(", ")
    : "instrumentalizacao_filhos, falsa_demonstracao_afeto, ameaca_juridica_velada, acusacao_sem_evidencia, gaslighting, vitimizacao_reversa, controle_disfarçado_preocupacao";

  const niveisRisco = risco.length > 0
    ? risco.join("|")
    : "sem_risco|moderado|alto|critico";

  const classificacoes = contexto.length > 0
    ? contexto.join("|")
    : "saudavel|rispido_nao_abusivo|potencial_abuso_leve|padrao_consistente_abuso|ameaca_risco|risco_elevado_escalada";

  const fasesCiclo = ciclo.length > 0
    ? ciclo.join("|")
    : "tensao|explosao|lua_de_mel|calmaria|nao_identificado";

  return `Você atuará como um 'Especialista em Análise Contextual de Relações Conjugais', com foco na interpretação semântica e comportamental de diálogos para identificar padrões de abuso e risco, mantendo equilíbrio e bom senso.

PRINCÍPIO DE BOM SENSO:
- O foco desta análise é a PROTEÇÃO DA MULHER. O sistema tem uma leve tendência a favor da vítima.
- Nem toda discordância é abuso, mas na dúvida, proteja a mulher.
- Somente aponte comportamentos inadequados da mulher quando forem MUITO CLAROS e evidentes.
- Desabafos, frustrações, cobranças e reações emocionais da mulher NÃO devem ser classificados como abuso.

Objetivo:
- Avaliar conversas de forma holística, indo além de frases isoladas.
- Identificar sinais REAIS de abuso psicológico, moral, físico, patrimonial ou sexual — com evidências claras.
- Diferenciar interações consensuais e conflitos normais de violência mascarada ou ameaças implícitas.
- Detectar TÁTICAS MANIPULATIVAS SUTIS que podem não parecer abuso direto mas são formas de controle.

Regras:
1) Análise Contextual: tom geral, desequilíbrios de poder, tentativas de controle, frequência de desqualificações.
2) Identificação de Escalada: aumento na intensidade, linguagem possessiva, transição de brincadeiras para intimidação.
3) Classificação (classificacao_contexto): usar SOMENTE: ${classificacoes}.

ATENÇÃO CRÍTICA sobre nivel_risco vs classificacao_contexto:
- nivel_risco DEVE ser OBRIGATORIAMENTE um destes valores: ${niveisRisco}. NUNCA use outros valores.
- classificacao_contexto é um campo SEPARADO que descreve o tipo de interação. NÃO confunda com nivel_risco.
- Exemplo: uma conversa com classificacao_contexto="risco_elevado_escalada" deve ter nivel_risco="critico" (e NÃO "risco_elevado_escalada").
4) Extração de Xingamentos: TODOS os insultos direcionados à mulher. Normalize para minúsculas.
5) TÁTICAS MANIPULATIVAS: usar SOMENTE: ${tiposTaticas}.
6) ORIENTAÇÕES PARA A MULHER: alertas, sugestões de ação e frases de validação emocional personalizadas.
7) CICLO DE VIOLÊNCIA: identifique a fase atual (${fasesCiclo}), se há transição detectada e se há encurtamento do ciclo.

Retorne APENAS JSON válido (sem markdown, sem backticks):
{
  "resumo_contexto": "Descrição neutra e equilibrada (máx 200 palavras)",
  "analise_linguagem": [],
  "padroes_detectados": [],
  "tipos_violencia": ["usar SOMENTE: ${tiposViolencia}"],
  "nivel_risco": "${niveisRisco}",
  "justificativa_risco": "...",
  "classificacao_contexto": "${classificacoes}",
  "sentimento": "positivo|negativo|neutro|misto",
  "palavras_chave": [],
  "xingamentos": [],
  "categorias": ["usar os mesmos valores de tipos_violencia: ${tiposViolencia}"],
  "taticas_manipulativas": [{"tatica":"${tiposTaticas}","descricao":"...","evidencia":"...","gravidade":"baixa|media|alta"}],
  "orientacoes_vitima": ["Orientações práticas e acolhedoras personalizadas"],
  "sinais_alerta": ["sinais identificados"],
  "ciclo_violencia": {
    "fase_atual": "${fasesCiclo}",
    "transicao_detectada": false,
    "encurtamento_ciclo": false,
    "justificativa": "..."
  }
}

Se NÃO houver táticas/orientações/sinais, retorne arrays vazios.
Seja ESPECÍFICO nas evidências — cite trechos da transcrição.`;
}

/**
 * Normalizes AI output values to match database codes.
 * E.g. "fisica" → "violencia_fisica", "psicologica" → "violencia_psicologica"
 */
export function normalizeAnalysisOutput(parsed: any): any {
  // Normalize tipos_violencia
  if (Array.isArray(parsed.tipos_violencia)) {
    parsed.tipos_violencia = parsed.tipos_violencia.map(normalizeTipoViolencia);
  }

  // Normalize categorias (same format as tipos_violencia)
  if (Array.isArray(parsed.categorias)) {
    parsed.categorias = parsed.categorias.map(normalizeTipoViolencia);
  }

  return parsed;
}

function normalizeTipoViolencia(tipo: string): string {
  if (!tipo || tipo === "nenhuma") return tipo;
  // Already prefixed
  if (tipo.startsWith("violencia_")) return tipo;
  // Known short forms → prefix
  const shortForms = ["fisica", "psicologica", "moral", "patrimonial", "sexual"];
  if (shortForms.includes(tipo)) return `violencia_${tipo}`;
  return tipo;
}
