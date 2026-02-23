-- Tabela para registrar todos os payloads enviados às integrações externas
CREATE TABLE public.payload_integracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integracao TEXT NOT NULL,
  user_id TEXT,
  protocol_id TEXT,
  payload JSONB NOT NULL,
  resposta JSONB,
  sucesso BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_payload_integracoes_integracao ON public.payload_integracoes (integracao);
CREATE INDEX idx_payload_integracoes_user_id ON public.payload_integracoes (user_id);
CREATE INDEX idx_payload_integracoes_created_at ON public.payload_integracoes (created_at DESC);

ALTER TABLE public.payload_integracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.payload_integracoes
  FOR ALL USING (true) WITH CHECK (true);