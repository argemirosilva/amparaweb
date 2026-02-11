
-- 1) Add new columns to usuarios (vítima profile data)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS endereco_fixo text,
  ADD COLUMN IF NOT EXISTS tem_filhos boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mora_com_agressor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completo boolean DEFAULT false;

-- 2) Create guardioes table
CREATE TABLE IF NOT EXISTS public.guardioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  vinculo text NOT NULL,
  telefone_whatsapp text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guardioes ENABLE ROW LEVEL SECURITY;

-- 3) Create agressores table (ficha global, reutilizável)
CREATE TABLE IF NOT EXISTS public.agressores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_nascimento date,
  telefone text,
  nome_pai_parcial text,
  nome_mae_parcial text,
  forca_seguranca boolean DEFAULT false,
  tem_arma_em_casa boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agressores ENABLE ROW LEVEL SECURITY;

-- 4) Create vitimas_agressores (vínculo vítima → agressor)
CREATE TABLE IF NOT EXISTS public.vitimas_agressores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  agressor_id uuid NOT NULL REFERENCES public.agressores(id) ON DELETE CASCADE,
  tipo_vinculo text NOT NULL,
  status_relacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, agressor_id)
);

ALTER TABLE public.vitimas_agressores ENABLE ROW LEVEL SECURITY;

-- 5) Triggers for updated_at
CREATE TRIGGER update_guardioes_updated_at
  BEFORE UPDATE ON public.guardioes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agressores_updated_at
  BEFORE UPDATE ON public.agressores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vitimas_agressores_updated_at
  BEFORE UPDATE ON public.vitimas_agressores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) RLS: block all direct access (service_role bypasses RLS)
CREATE POLICY "Block direct access guardioes" ON public.guardioes
  FOR ALL USING (false);

CREATE POLICY "Block direct access agressores" ON public.agressores
  FOR ALL USING (false);

CREATE POLICY "Block direct access vitimas_agressores" ON public.vitimas_agressores
  FOR ALL USING (false);

-- 7) Indexes for search
CREATE INDEX IF NOT EXISTS idx_agressores_telefone ON public.agressores(telefone);
CREATE INDEX IF NOT EXISTS idx_agressores_nome ON public.agressores(nome);
CREATE INDEX IF NOT EXISTS idx_vitimas_agressores_usuario ON public.vitimas_agressores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vitimas_agressores_agressor ON public.vitimas_agressores(agressor_id);
CREATE INDEX IF NOT EXISTS idx_guardioes_usuario ON public.guardioes(usuario_id);
