-- Tabela de ocorrências registradas em campo pelas forças de segurança
CREATE TABLE IF NOT EXISTS public.ocorrencias_campo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vitima_id UUID NOT NULL,
  
  -- Dados estruturados do atendimento
  situacao TEXT NOT NULL CHECK (situacao IN ('ocorrencia_confirmada','sem_evidencia_no_local','conflito_verbal','violencia_fisica')),
  comportamento_requerido TEXT CHECK (comportamento_requerido IN ('comportamento_agressivo','comportamento_intimidatorio','comportamento_colaborativo')),
  estado_vitima TEXT CHECK (estado_vitima IN ('vitima_com_medo','vitima_retraida','vitima_estavel')),
  contexto TEXT[] DEFAULT '{}'::text[],
  observacao TEXT CHECK (char_length(observacao) <= 300),

  -- Identificação do agente (texto livre por enquanto, futuro: agente_id UUID)
  agente_identificacao TEXT,
  agente_orgao TEXT,
  protocolo_externo TEXT,

  -- Localização opcional
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,

  -- Snapshot do que foi exibido ao policial (para auditoria)
  nivel_risco_snapshot TEXT,
  tags_snapshot TEXT[] DEFAULT '{}'::text[],

  -- Metadados de acesso
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ocorrencias_campo_vitima ON public.ocorrencias_campo(vitima_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_campo_created ON public.ocorrencias_campo(created_at DESC);

-- RLS: bloqueia acesso direto (tudo passa pela edge function)
ALTER TABLE public.ocorrencias_campo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access ocorrencias_campo"
ON public.ocorrencias_campo
FOR ALL
USING (false)
WITH CHECK (false);

-- Tabela de logs de acesso (auditoria de consultas, sem registro de ocorrência)
CREATE TABLE IF NOT EXISTS public.campo_access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vitima_id UUID,
  query_type TEXT NOT NULL, -- 'busca_cpf','busca_telefone','busca_nome','consulta_indicadores','registro_ocorrencia'
  query_value_hash TEXT, -- hash do valor consultado (sem expor PII)
  found BOOLEAN NOT NULL DEFAULT false,
  agente_identificacao TEXT,
  agente_orgao TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campo_logs_vitima ON public.campo_access_logs(vitima_id);
CREATE INDEX IF NOT EXISTS idx_campo_logs_created ON public.campo_access_logs(created_at DESC);

ALTER TABLE public.campo_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block direct access campo_access_logs"
ON public.campo_access_logs
FOR ALL
USING (false)
WITH CHECK (false);