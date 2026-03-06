UPDATE monitoramento_sessoes
SET status = 'aguardando_finalizacao',
    closed_at = now(),
    sealed_reason = 'device_rotation_orphan',
    finalizado_em = now()
WHERE id = 'ad835fb8-1234-4567-8901-234567890abc'
  AND status = 'ativa';

-- Note: Replace the UUID above with the actual full session ID if different