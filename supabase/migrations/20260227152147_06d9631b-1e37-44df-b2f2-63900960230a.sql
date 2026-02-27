
UPDATE monitoramento_sessoes 
SET status = 'encerrada', finalizado_em = now(), closed_at = now(), sealed_reason = 'manual_reset_duplicate'
WHERE user_id = '1edfc5e3-f28d-4f42-b491-105945fa7e13' AND status = 'ativa';
