
-- Adicionar coluna emotional_avatars na tabela usuarios
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS emotional_avatars jsonb DEFAULT NULL;

-- Criar bucket user-emotions
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-emotions', 'user-emotions', true)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública
CREATE POLICY "Public read user-emotions"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-emotions');

-- Política de escrita via service role (edge functions)
CREATE POLICY "Service write user-emotions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-emotions');

CREATE POLICY "Service update user-emotions"
ON storage.objects FOR UPDATE
USING (bucket_id = 'user-emotions');

CREATE POLICY "Service delete user-emotions"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-emotions');
