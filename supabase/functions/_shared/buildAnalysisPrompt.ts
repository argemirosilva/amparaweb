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

  return `Analise a transcrição abaixo e classifique o nível de risco de violência doméstica.
Retorne APENAS JSON: {"resultado":"seguro|moderado|alto|critico","motivo":"justificativa curta"}

Regras:
- "seguro": silêncio, assunto cotidiano, conversa amigável, sem indicadores de risco
- "moderado": tensão verbal, tom ríspido, mas sem ameaça direta
- "alto": ameaças diretas, gritos intensos, agressão verbal grave, humilhação
- "critico": violência física iminente ou em curso, pedidos de socorro, menção a armas

Seja conservador: na dúvida entre dois níveis, escolha o mais alto para proteger a mulher.`;
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

  return `Você é uma especialista em proteção à mulher e relações conjugais, com profunda sensibilidade emocional. Analise os dados agregados abaixo e gere um relatório detalhado, acolhedor, elegante e organizado.

PRINCÍPIO: Foco na PROTEÇÃO DA MULHER. Na dúvida, proteja-a. Seja empática e gentil na comunicação.

ABORDAGEM DE COMUNICAÇÃO (OBRIGATÓRIO):
- Fale como uma amiga sábia, experiente e acolhedora. NUNCA use termos como "terapia cognitiva", "reenquadramento", "psicoeducação", "técnica psicológica", "validação emocional" ou qualquer jargão clínico.
- SEMPRE comece validando o que a mulher pode estar sentindo antes de orientar. Reconheça que os sentimentos dela são legítimos.
- Normalize as experiências: use frases como "é completamente normal sentir isso...", "muitas mulheres passam por isso...", "é natural questionar...".
- Destaque forças e ações positivas que ela JÁ demonstrou (ex: "o fato de você estar acompanhando isso já mostra muita coragem e autocuidado").
- Ajude a ver a situação de outros ângulos sem invalidar o que ela sente. Explique dinâmicas de poder e ciclos de forma natural, como quem compartilha uma experiência de vida.
- Reflita de volta o que ela demonstrou sentir, como um espelho gentil.
- Lembre-a de suas próprias forças e capacidades.
- Ajude a alinhar percepção com realidade sem confrontar diretamente.

DADOS (últimos ${windowDays} dias):
${aggregatesJson}

INSTRUÇÕES:
- No "panorama_narrativo": escreva 5-8 frases. COMECE validando sentimentos ("os registros mostram uma situação que pode gerar muita confusão emocional — é completamente normal sentir-se assim"). Descreva padrões observados explicando dinâmicas de forma educativa mas natural. Destaque algo positivo que ela fez ou demonstrou. Termine com uma perspectiva que fortaleça a confiança dela em si mesma.
- No "resumo": escreva 2-3 frases como um resumo curto do panorama, mantendo o tom acolhedor.
- Nas "orientacoes": forneça 4-6 sugestões GENTIS e ACOLHEDORAS. Use linguagem que promova auto-reflexão ("você já percebeu que...", "vale se perguntar...", "pode ser revelador pensar..."). Fortaleça a sensação de capacidade dela ("você já demonstrou que consegue..."). Sugira ações como se fossem insights naturais, não prescrições. Reduza culpa quando possível.
- Na "reflexao_pessoal": inclua 1-2 perguntas reflexivas sutis e acolhedoras que a mulher pode ponderar consigo mesma. Devem ser perguntas que promovam autoconhecimento sem parecer exercício terapêutico. Ex: "O que você faria de diferente se uma amiga querida estivesse vivendo isso?" ou "Quando foi a última vez que você se sentiu verdadeiramente em paz?".
- Nas "principais_ofensas": liste os xingamentos e termos depreciativos mais frequentes identificados. Se não houver, retorne array vazio.
- NÃO inclua score numérico em nenhum campo.
- Só inclua canais de apoio se o nível for alto ou crítico.

RETORNE APENAS JSON:
{
  "panorama_narrativo": "5-8 frases detalhadas, começando com validação emocional.",
  "resumo": "2-3 frases resumindo com tom acolhedor.",
  "orientacoes": ["sugestão gentil 1", "sugestão gentil 2", "sugestão gentil 3", "sugestão gentil 4"],
  "reflexao_pessoal": ["pergunta reflexiva sutil 1", "pergunta reflexiva sutil 2"],
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
