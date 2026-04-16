-- ==========================================
-- AMPARA CAMPO API KEYS - integração externa para forças de segurança
-- ==========================================
CREATE TABLE public.campo_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  orgao text NOT NULL,
  label text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid
);

CREATE INDEX idx_campo_api_keys_hash ON public.campo_api_keys(key_hash) WHERE ativo = true;
CREATE INDEX idx_campo_api_keys_orgao ON public.campo_api_keys(orgao);

ALTER TABLE public.campo_api_keys ENABLE ROW LEVEL SECURITY;

-- Bloqueia acesso direto: apenas service_role (edge function) pode operar
CREATE POLICY "Block direct access campo_api_keys"
  ON public.campo_api_keys FOR ALL
  USING (false) WITH CHECK (false);

-- Adiciona coluna api_key_id em campo_access_logs para auditoria
ALTER TABLE public.campo_access_logs
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES public.campo_api_keys(id) ON DELETE SET NULL;

ALTER TABLE public.ocorrencias_campo
  ADD COLUMN IF NOT EXISTS api_key_id uuid REFERENCES public.campo_api_keys(id) ON DELETE SET NULL;