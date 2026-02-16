-- Tabela de órgãos/tenants
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  sigla text NOT NULL,
  tipo text NOT NULL DEFAULT 'orgao',
  cnpj text,
  email_contato text,
  telefone_contato text,
  endereco text,
  cidade text,
  uf text,
  responsavel_nome text,
  responsavel_email text,
  ativo boolean NOT NULL DEFAULT true,
  max_usuarios integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Admins podem ler tenants (via anon key, custom auth)
CREATE POLICY "Allow anon select tenants"
  ON public.tenants FOR SELECT
  USING (true);

-- Block direct writes (managed via edge functions / service role)
CREATE POLICY "Block direct write tenants"
  ON public.tenants FOR ALL
  USING (false)
  WITH CHECK (false);

-- Trigger para updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de configurações do sistema
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL,
  descricao text,
  categoria text NOT NULL DEFAULT 'geral',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select admin_settings"
  ON public.admin_settings FOR SELECT
  USING (true);

CREATE POLICY "Block direct write admin_settings"
  ON public.admin_settings FOR ALL
  USING (false)
  WITH CHECK (false);

-- Seed default settings
INSERT INTO public.admin_settings (chave, valor, descricao, categoria) VALUES
  ('retencao_dias_padrao', '30', 'Dias de retenção padrão de gravações sem risco', 'dados'),
  ('max_guardioes_por_usuario', '5', 'Número máximo de guardiões por usuária', 'limites'),
  ('tempo_janela_panico_segundos', '300', 'Janela de cancelamento do alerta de pânico (segundos)', 'panico'),
  ('gps_duracao_padrao_minutos', '30', 'Duração padrão de compartilhamento GPS (minutos)', 'gps'),
  ('notificacao_email_ativa', 'true', 'Envio de notificações por e-mail está ativo', 'notificacoes'),
  ('notificacao_whatsapp_ativa', 'true', 'Envio de notificações por WhatsApp está ativo', 'notificacoes'),
  ('manutencao_ativa', 'false', 'Modo de manutenção ativo no sistema', 'sistema'),
  ('versao_minima_app', '1.0.0', 'Versão mínima aceita do app mobile', 'sistema');

-- Vincular user_roles ao tenant
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT NULL;