
-- Tabela centralizada de tipos de alerta/violência para curadoria
CREATE TABLE IF NOT EXISTS public.tipos_alerta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo text NOT NULL,           -- 'violencia', 'tatica', 'risco', 'categoria'
  codigo text NOT NULL UNIQUE,   -- slug normalizado (ex: 'violencia_psicologica')
  label text NOT NULL,           -- nome exibido (ex: 'Violência Psicológica')
  descricao text,                -- descrição opcional
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index para busca rápida por grupo
CREATE INDEX idx_tipos_alerta_grupo ON public.tipos_alerta(grupo, ativo);

-- RLS: leitura pública (anon), escrita apenas admin via service_role
ALTER TABLE public.tipos_alerta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura publica tipos_alerta"
  ON public.tipos_alerta FOR SELECT
  TO anon, authenticated
  USING (true);

-- Popular com tipos de violência extraídos dos dados existentes
INSERT INTO public.tipos_alerta (grupo, codigo, label, ordem) VALUES
  -- Tipos de violência
  ('violencia', 'violencia_psicologica', 'Violência Psicológica', 1),
  ('violencia', 'violencia_fisica', 'Violência Física', 2),
  ('violencia', 'violencia_moral', 'Violência Moral', 3),
  ('violencia', 'violencia_patrimonial', 'Violência Patrimonial', 4),
  ('violencia', 'violencia_sexual', 'Violência Sexual', 5),
  ('violencia', 'ameaca', 'Ameaça', 6),
  ('violencia', 'assedio', 'Assédio', 7),
  ('violencia', 'assedio_moral', 'Assédio Moral', 8),
  ('violencia', 'coercao', 'Coerção', 9),
  ('violencia', 'chantagem', 'Chantagem', 10),
  ('violencia', 'chantagem_emocional', 'Chantagem Emocional', 11),
  ('violencia', 'humilhacao', 'Humilhação', 12),
  ('violencia', 'desqualificacao', 'Desqualificação', 13),
  ('violencia', 'isolamento', 'Isolamento', 14),
  ('violencia', 'controle', 'Controle', 15),
  ('violencia', 'manipulacao', 'Manipulação', 16),
  ('violencia', 'abuso_psicologico', 'Abuso Psicológico', 17),
  ('violencia', 'abuso_emocional', 'Abuso Emocional', 18),
  -- Táticas manipulativas
  ('tatica', 'gaslighting', 'Gaslighting', 1),
  ('tatica', 'vitimizacao_reversa', 'Vitimização Reversa', 2),
  ('tatica', 'instrumentalizacao_filhos', 'Instrumentalização dos Filhos', 3),
  ('tatica', 'falsa_demonstracao_afeto', 'Falsa Demonstração de Afeto', 4),
  ('tatica', 'ameaca_juridica_velada', 'Ameaça Jurídica Velada', 5),
  ('tatica', 'acusacao_sem_evidencia', 'Acusação sem Evidência', 6),
  ('tatica', 'controle_disfarcado_preocupacao', 'Controle Disfarçado de Preocupação', 7),
  ('tatica', 'desqualificacao_terceiros', 'Desqualificação de Terceiros', 8),
  -- Categorias de curadoria (usadas no popover)
  ('curadoria', 'xingamento', 'Xingamento', 1),
  ('curadoria', 'sinal_alerta', 'Sinal de Alerta', 2),
  ('curadoria', 'falso_positivo', 'Falso Positivo (Nenhum)', 3),
  -- Níveis de risco (referência)
  ('risco', 'sem_risco', 'Sem Risco', 1),
  ('risco', 'moderado', 'Moderado', 2),
  ('risco', 'alto', 'Alto', 3),
  ('risco', 'critico', 'Crítico', 4),
  -- Classificações de contexto
  ('contexto', 'saudavel', 'Saudável', 1),
  ('contexto', 'rispido_nao_abusivo', 'Ríspido mas Não Abusivo', 2),
  ('contexto', 'potencial_abuso_leve', 'Potencial Abuso Leve', 3),
  ('contexto', 'padrao_consistente_abuso', 'Padrão Consistente de Abuso', 4),
  ('contexto', 'ameaca_risco', 'Ameaça com Risco', 5),
  ('contexto', 'risco_elevado_escalada', 'Risco Elevado de Escalada', 6)
ON CONFLICT (codigo) DO NOTHING;
