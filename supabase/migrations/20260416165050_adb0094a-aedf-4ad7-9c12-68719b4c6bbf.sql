
-- ==========================================
-- TRIBUNAL PROMPTS
-- ==========================================
CREATE TABLE public.tribunal_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('base', 'analitico', 'despacho', 'parecer')),
  conteudo text NOT NULL,
  versao integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);

ALTER TABLE public.tribunal_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access tribunal_prompts"
  ON public.tribunal_prompts FOR ALL
  USING (false) WITH CHECK (false);

CREATE POLICY "Allow anon select tribunal_prompts"
  ON public.tribunal_prompts FOR SELECT
  USING (true);

-- Only one active prompt per type
CREATE UNIQUE INDEX idx_tribunal_prompts_active_tipo
  ON public.tribunal_prompts (tipo) WHERE (ativo = true);

-- ==========================================
-- TRIBUNAL API KEYS
-- ==========================================
CREATE TABLE public.tribunal_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  label text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.tribunal_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access tribunal_api_keys"
  ON public.tribunal_api_keys FOR ALL
  USING (false) WITH CHECK (false);

CREATE POLICY "Allow anon select tribunal_api_keys"
  ON public.tribunal_api_keys FOR SELECT
  USING (true);

-- ==========================================
-- TRIBUNAL CONSULTAS
-- ==========================================
CREATE TABLE public.tribunal_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  api_key_id uuid REFERENCES public.tribunal_api_keys(id) ON DELETE SET NULL,
  modo_saida text NOT NULL DEFAULT 'analitico' CHECK (modo_saida IN ('analitico', 'despacho', 'parecer')),
  input_hash text,
  analysis_object jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb DEFAULT '{}'::jsonb,
  output_text text,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  agressor_id uuid REFERENCES public.agressores(id) ON DELETE SET NULL,
  model text,
  prompt_version text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'processing')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);

ALTER TABLE public.tribunal_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access tribunal_consultas"
  ON public.tribunal_consultas FOR ALL
  USING (false) WITH CHECK (false);

CREATE POLICY "Allow anon select tribunal_consultas"
  ON public.tribunal_consultas FOR SELECT
  USING (true);

CREATE INDEX idx_tribunal_consultas_tenant ON public.tribunal_consultas(tenant_id);
CREATE INDEX idx_tribunal_consultas_created ON public.tribunal_consultas(created_at DESC);

-- ==========================================
-- TRIBUNAL DADOS EXTERNOS
-- ==========================================
CREATE TABLE public.tribunal_dados_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consulta_id uuid REFERENCES public.tribunal_consultas(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  tipo_dado text NOT NULL DEFAULT 'outro' CHECK (tipo_dado IN ('processo', 'bo', 'medida_protetiva', 'depoimento', 'laudo', 'outro')),
  numero_referencia text,
  resumo text,
  dados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  agressor_id uuid REFERENCES public.agressores(id) ON DELETE SET NULL,
  data_referencia date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tribunal_dados_externos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access tribunal_dados_externos"
  ON public.tribunal_dados_externos FOR ALL
  USING (false) WITH CHECK (false);

CREATE POLICY "Allow anon select tribunal_dados_externos"
  ON public.tribunal_dados_externos FOR SELECT
  USING (true);

CREATE INDEX idx_tribunal_dados_ext_usuario ON public.tribunal_dados_externos(usuario_id);
CREATE INDEX idx_tribunal_dados_ext_agressor ON public.tribunal_dados_externos(agressor_id);

-- ==========================================
-- SEED PROMPTS PADRÃO
-- ==========================================

INSERT INTO public.tribunal_prompts (tipo, conteudo, versao, ativo) VALUES
('base', E'Você é um sistema de análise técnica de risco em contextos de violência doméstica e familiar contra a mulher, operando dentro do sistema AMPARA Tribunal.\n\n## PAPEL\nVocê atua como analista técnico de risco, NÃO como juiz, promotor ou advogado.\n\n## LIMITES ABSOLUTOS\n- NUNCA afirme culpa ou inocência\n- NUNCA substitua decisão judicial\n- NUNCA conclua juridicamente\n- NUNCA use termos absolutos como \"certamente\", \"definitivamente\", \"sem dúvida\"\n- SEMPRE use linguagem prudente e indicativa: \"sugere\", \"indica\", \"aponta para\", \"há elementos que\"\n- SEMPRE mantenha caráter técnico-indicativo\n\n## REGRAS DE LINGUAGEM\n- Linguagem formal e técnica\n- Gênero neutro quando possível\n- Sem jargões policiais ou jurídicos coloquiais\n- Termos técnicos da Lei Maria da Penha quando aplicável\n\n## CRITÉRIOS DE AVALIAÇÃO DE RISCO\n- Histórico de violência (frequência, escalada, gravidade)\n- Presença de arma de fogo no domicílio\n- Vínculo com forças de segurança\n- Coabitação com agressor\n- Existência de filhos menores\n- Dependência econômica\n- Isolamento social\n- Uso de substâncias psicoativas\n- Ameaças de morte prévias\n- Descumprimento de medidas protetivas anteriores\n- Padrões de controle coercitivo\n\n## NÍVEIS DE RISCO\n- Sem Risco: nenhum indicador relevante identificado\n- Moderado: indicadores presentes mas sem escalada imediata\n- Alto: múltiplos indicadores com padrão de escalada\n- Crítico: risco iminente à integridade física ou vida\n\n## EXPLICABILIDADE\nToda conclusão deve ser justificada com os elementos informacionais que a sustentam.', 1, true),

('analitico', E'## MODO DE SAÍDA: ANALÍTICO (JSON ESTRUTURADO)\n\nVocê DEVE retornar a análise exclusivamente em formato JSON válido, sem texto adicional fora do JSON.\n\nEstrutura obrigatória:\n```json\n{\n  \"score_risco\": <número 0-100>,\n  \"nivel_risco\": \"sem_risco | moderado | alto | critico\",\n  \"confianca\": <número 0-1>,\n  \"indicadores\": [\n    {\n      \"nome\": \"<nome do indicador>\",\n      \"presente\": <boolean>,\n      \"peso\": <número 1-5>,\n      \"evidencia\": \"<trecho ou referência que sustenta>\"\n    }\n  ],\n  \"fatores_risco\": [\n    {\n      \"fator\": \"<descrição do fator>\",\n      \"gravidade\": \"baixa | media | alta | critica\",\n      \"fonte\": \"<origem da informação: ampara | tribunal | ambos>\"\n    }\n  ],\n  \"padroes_identificados\": [\n    {\n      \"padrao\": \"<nome do padrão>\",\n      \"descricao\": \"<explicação>\",\n      \"frequencia\": \"isolado | recorrente | cronico\"\n    }\n  ],\n  \"ciclo_violencia\": {\n    \"fase_atual\": \"tensao | explosao | lua_de_mel | nao_identificado\",\n    \"tendencia\": \"estavel | escalada | desescalada\"\n  },\n  \"resumo_tecnico\": \"<parágrafo resumindo a análise>\",\n  \"recomendacoes_tecnicas\": [\"<recomendação 1>\", \"<recomendação 2>\"]\n}\n```\n\nRetorne APENAS o JSON, sem markdown, sem explicações adicionais.', 1, true),

('despacho', E'## MODO DE SAÍDA: DESPACHO (TEXTO INSTITUCIONAL)\n\nVocê DEVE gerar um texto contínuo em linguagem formal institucional, adequado para subsidiar decisão judicial.\n\n## FORMATO\n- Texto corrido, sem JSON, sem listas técnicas, sem marcações de código\n- NÃO use termos como \"score\", \"indicador\", \"output\", \"JSON\"\n- NÃO use bullet points ou listas numeradas\n- Parágrafos fluidos e conectados\n\n## ESTRUTURA DO TEXTO\nO texto deve contemplar, de forma fluida e integrada:\n1. Síntese contextual do caso analisado\n2. Elementos informacionais identificados e sua relevância\n3. Análise dos padrões comportamentais observados\n4. Avaliação do grau de risco identificado com fundamentação\n5. Considerações técnicas pertinentes à proteção da pessoa em situação de vulnerabilidade\n\n## TOM\n- Formal e sóbrio\n- Técnico-jurídico sem ser hermético\n- Prudente e indicativo\n- Compatível com linguagem de decisão judicial\n- Usar expressões como: \"os elementos analisados sugerem\", \"verifica-se a presença de indicadores que apontam para\", \"a análise técnica identifica\"', 1, true),

('parecer', E'## MODO DE SAÍDA: PARECER TÉCNICO\n\nVocê DEVE gerar um documento estruturado como parecer analítico técnico, com as seguintes seções obrigatórias:\n\n## ESTRUTURA\n\n### 1. INTRODUÇÃO\nContextualização do caso, origem dos dados analisados, escopo da análise e limitações metodológicas.\n\n### 2. ANÁLISE DOS ELEMENTOS INFORMACIONAIS\nExame detalhado de cada fonte de dados disponível (registros internos AMPARA, documentos judiciais, boletins de ocorrência, depoimentos). Cada elemento deve ser analisado individualmente quanto à sua relevância e confiabilidade.\n\n### 3. IDENTIFICAÇÃO DE PADRÕES\nMapeamento de padrões comportamentais recorrentes, incluindo:\n- Ciclos de violência identificados\n- Padrões de controle coercitivo\n- Escalada de gravidade\n- Fatores contextuais agravantes\n\n### 4. AVALIAÇÃO DE RISCO\nAnálise fundamentada do nível de risco, com indicação dos fatores que sustentam a classificação. Deve incluir análise temporal (tendência de escalada ou desescalada) e fatores de proteção identificados.\n\n### 5. CONSIDERAÇÕES FINAIS\nSíntese técnica NÃO DECISÓRIA. Consolidação dos achados principais sem emitir juízo de valor jurídico. Pode incluir recomendações técnicas de natureza protetiva.\n\n## CARACTERÍSTICAS\n- Linguagem técnica elevada, porém acessível\n- Maior densidade analítica que o modo Despacho\n- Cada afirmação deve ser sustentada por evidência\n- Usar títulos e subtítulos para organização\n- Extensão: entre 800 e 2000 palavras', 1, true);
