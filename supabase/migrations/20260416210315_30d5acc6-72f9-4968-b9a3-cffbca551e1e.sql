-- Adicionar coluna tipo_sistema
ALTER TABLE public.tribunal_api_keys
  ADD COLUMN IF NOT EXISTS tipo_sistema text NOT NULL DEFAULT 'judicial'
    CHECK (tipo_sistema IN ('judicial', 'forca_seguranca', 'outro'));

-- Tornar tenant_id opcional (forças de segurança podem não ter tenant judicial)
ALTER TABLE public.tribunal_api_keys
  ALTER COLUMN tenant_id DROP NOT NULL;

-- Adicionar coluna orgao (nome livre para identificar o órgão usuário)
ALTER TABLE public.tribunal_api_keys
  ADD COLUMN IF NOT EXISTS orgao text;

-- Index por tipo
CREATE INDEX IF NOT EXISTS idx_tribunal_api_keys_tipo_sistema
  ON public.tribunal_api_keys(tipo_sistema);