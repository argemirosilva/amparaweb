UPDATE monitoramento_sessoes
SET status = 'aguardando_finalizacao',
    closed_at = now(),
    sealed_reason = 'device_rotation_orphan',
    finalizado_em = now()
WHERE id = 'ad835fb8-e0b7-4710-9c35-6409b5407aaf'
  AND status = 'ativa'