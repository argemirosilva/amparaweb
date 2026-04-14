/**
 * Shared utility: builds the AI analysis prompt dynamically
 * from the `tipos_alerta` table, ensuring prompt values always
 * match the database codes.
 *
 * Priority: admin_settings override > dynamic template.
 */

/**
 * Builds a lightweight triage prompt for quick risk classification.
 * Checks admin_settings for override first, then uses default.
 */
export async function buildTriagePrompt(supabase: any): Promise<string> {
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("valor")
      .eq("chave", "ia_prompt_triagem")
      .maybeSingle();
    if (data?.valor?.trim()) return data.valor.trim();
  } catch { /* use default */ }

  return `Você é um classificador binário de risco em diálogos de violência doméstica. Analise a transcrição e retorne APENAS JSON válido (sem markdown):

{
  "resultado": "seguro|moderado|alto|critico",
  "motivo": "frase curta justificando",
  "contexto_emergencia": {
    "ameaca_morte": false,
    "agressao_fisica": false,
    "agressao_em_curso": false,
    "ameaca_agressao_fisica": false,
    "pedido_socorro": false,
    "mencao_arma": false,
    "descricao_curta": ""
  }
}

Regras para "resultado":
- "seguro": conversa normal, sem conflito, monólogo, silêncio ou assunto cotidiano
- "moderado": tom ríspido, tensão leve, cobranças agressivas
- "alto": xingamentos direcionados, ameaças veladas, controle/manipulação
- "critico": ameaças explícitas de violência, menção a armas, gritos intensos

Regras para "contexto_emergencia" (preencher apenas quando resultado NÃO for "seguro"):
- "ameaca_morte": ameaça explícita de matar ou risco de morte implícito
- "agressao_fisica": sinais de que houve agressão física (bateu, empurrou, chutou)
- "agressao_em_curso": agressão acontecendo no momento (gritos de dor, impactos)
- "ameaca_agressao_fisica": ameaça de bater, agredir, machucar
- "pedido_socorro": vítima pedindo ajuda, socorro
- "mencao_arma": menção a faca, arma de fogo ou objeto usado como arma
- "descricao_curta": resumo de 1 frase do que está acontecendo (para notificações de emergência)

Se resultado for "seguro", todos os campos de contexto_emergencia devem ser false e descricao_curta vazio.

Na dúvida entre seguro e moderado, escolha moderado (proteja a mulher).

Seja objetivo. Não explique além do campo "motivo".`;
}

/**
 * Builds the MACRO (aggregated report) prompt.
 * Checks admin_settings for override first, then uses default.
 */
export async function buildMacroPrompt(supabase: any, windowDays: number, aggregatesJson: string): Promise<string> {
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("valor")
      .eq("chave", "ia_prompt_macro")
      .maybeSingle();
    if (data?.valor?.trim()) {
      // Replace placeholders
      return data.valor.trim()
        .replace(/\$\{window_days\}/g, String(windowDays))
        .replace(/\$\{aggregates\}/g, aggregatesJson);
    }
  } catch { /* use default */ }

  return `Você é uma especialista em proteção à mulher e análise de relações conjugais. Analise os dados agregados abaixo e gere um relatório claro, organizado e acessível.

PRINCÍPIO: Foco na PROTEÇÃO DA MULHER. Na dúvida, proteja-a. Seja respeitosa e empática, sem ser excessivamente informal.

TOM DE COMUNICAÇÃO (OBRIGATÓRIO):
- Use um tom acolhedor porém profissional — como uma orientadora experiente, NÃO como "amiga".
- NUNCA use termos como "terapia cognitiva", "reenquadramento", "psicoeducação" ou jargão clínico.
- NUNCA use expressões excessivamente informais como "amiga", "querida", "fique firme" ou "você é incrível".
- Seja direta e objetiva, sem rodeios desnecessários.
- Reconheça sentimentos sem dramatizar. Ex: "É compreensível sentir insegurança diante dessa situação."
- Use linguagem clara e acessível, adequada a qualquer nível de escolaridade.

DADOS (últimos \${window_days} dias):
\${aggregates}

INSTRUÇÕES:
- No "panorama_narrativo": escreva 3-5 frases objetivas. Descreva os padrões observados de forma clara. Aponte riscos identificados. Mencione aspectos positivos se houver. Evite repetições e frases longas.
- No "resumo": escreva 1-2 frases diretas resumindo a situação do período.
- Nas "orientacoes": forneça 3-4 orientações práticas e diretas. Use linguagem como "considere...", "é importante...", "procure...". Evite frases genéricas — cada orientação deve se basear nos dados analisados.
- Na "reflexao_pessoal": inclua 1 pergunta reflexiva objetiva que ajude na tomada de consciência. Ex: "Se alguém próximo estivesse nessa situação, o que você recomendaria?"
- Nas "principais_ofensas": liste os xingamentos e termos depreciativos mais frequentes. Array vazio se não houver.
- NÃO inclua score numérico em nenhum campo.
- Só inclua canais de apoio se o nível for alto ou crítico.

RETORNE APENAS JSON:
{
  "panorama_narrativo": "3-5 frases objetivas descrevendo padrões e riscos.",
  "resumo": "1-2 frases diretas.",
  "orientacoes": ["orientação prática 1", "orientação prática 2", "orientação prática 3"],
  "reflexao_pessoal": ["pergunta reflexiva objetiva"],
  "principais_ofensas": ["ofensa 1", "ofensa 2"],
  "canais_apoio": [],
  "nivel_alerta": "baixo|moderado|alto|critico"
}`;
}

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
6) ORIENTAÇÕES PARA A MULHER: Antes de orientar, SEMPRE valide o sentimento da mulher ("é compreensível sentir isso..."). Normalize a experiência ("muitas mulheres passam por isso..."). Destaque algo positivo que a mulher fez ou demonstrou na conversa. Inclua uma pergunta reflexiva sutil que promova autoconhecimento (ex: "o que você faria se uma amiga estivesse vivendo isso?"). Fortaleça a sensação de capacidade dela. Use linguagem de amiga sábia, NUNCA jargão clínico. Sugira ações como insights naturais.
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

  // Normalize nivel_risco to valid values only
  parsed.nivel_risco = normalizeNivelRisco(parsed.nivel_risco);

  return parsed;
}

const VALID_NIVEL_RISCO = ["sem_risco", "moderado", "alto", "critico"];

const NIVEL_RISCO_MAP: Record<string, string> = {
  "risco_elevado_escalada": "critico",
  "ameaca_risco": "critico",
  "elevado": "alto",
  "grave": "critico",
  "leve": "moderado",
  "baixo": "sem_risco",
  "nenhum": "sem_risco",
  "sem risco": "sem_risco",
};

function normalizeNivelRisco(nivel: string | undefined | null): string {
  if (!nivel) return "sem_risco";
  const lower = nivel.trim().toLowerCase();
  if (VALID_NIVEL_RISCO.includes(lower)) return lower;
  if (NIVEL_RISCO_MAP[lower]) return NIVEL_RISCO_MAP[lower];
  // If contains "critico" or "escalada" → critico
  if (lower.includes("critico") || lower.includes("escalada") || lower.includes("ameaca")) return "critico";
  if (lower.includes("alto") || lower.includes("elevado")) return "alto";
  if (lower.includes("moderado")) return "moderado";
  console.warn(`Unknown nivel_risco "${nivel}", defaulting to "moderado"`);
  return "moderado";
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
