INSERT INTO public.admin_settings (chave, valor, categoria, descricao)
VALUES 
  ('transcricao_provider', 'lovable_ai', 'transcricao', 'Provedor de transcrição: lovable_ai ou agreggar'),
  ('transcricao_api_url', 'https://api.agreggar.com/Transcription/Transcribe', 'transcricao', 'URL da API de transcrição (usado quando provider = agreggar ou custom)')
ON CONFLICT (chave) DO NOTHING;