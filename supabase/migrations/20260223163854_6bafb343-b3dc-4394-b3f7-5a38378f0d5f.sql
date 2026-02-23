CREATE TABLE curadoria_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id uuid NOT NULL REFERENCES gravacoes_analises(id) ON DELETE CASCADE,
  campo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  valor_corrigido jsonb,
  nota text,
  avaliado_por uuid REFERENCES usuarios(id),
  avaliado_em timestamptz DEFAULT now(),
  UNIQUE(analise_id, campo)
);

CREATE INDEX idx_curadoria_avaliacoes_analise ON curadoria_avaliacoes(analise_id);

ALTER TABLE curadoria_avaliacoes ENABLE ROW LEVEL SECURITY;