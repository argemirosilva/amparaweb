
CREATE TABLE public.palavras_triagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palavra text NOT NULL,
  grupo text NOT NULL DEFAULT 'ameaca',
  peso integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.palavras_triagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access palavras_triagem" ON public.palavras_triagem FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY "Allow anon select palavras_triagem" ON public.palavras_triagem FOR SELECT USING (true);

CREATE UNIQUE INDEX idx_palavras_triagem_palavra ON public.palavras_triagem(palavra);
