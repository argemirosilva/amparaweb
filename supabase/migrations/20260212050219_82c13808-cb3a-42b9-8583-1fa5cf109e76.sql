
-- Tabela para armazenar análises de IA das gravações
CREATE TABLE public.gravacoes_analises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gravacao_id uuid NOT NULL REFERENCES public.gravacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.usuarios(id),
  resumo text,
  sentimento text,
  nivel_risco text,
  categorias text[],
  palavras_chave text[],
  analise_completa jsonb,
  modelo_usado text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.gravacoes_analises ENABLE ROW LEVEL SECURITY;

-- Block direct access (all access via service role in edge functions)
CREATE POLICY "Block direct access gravacoes_analises"
  ON public.gravacoes_analises
  AS RESTRICTIVE
  FOR ALL
  USING (false);

-- Index
CREATE INDEX idx_gravacoes_analises_gravacao ON public.gravacoes_analises(gravacao_id);
CREATE INDEX idx_gravacoes_analises_user ON public.gravacoes_analises(user_id);
