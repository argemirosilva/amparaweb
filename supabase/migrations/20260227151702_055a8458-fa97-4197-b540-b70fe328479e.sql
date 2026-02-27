
UPDATE monitoramento_sessoes 
SET status = 'encerrada', finalizado_em = now(), closed_at = now(), sealed_reason = 'manual_reset'
WHERE id = '1e6132a4-2729-4300-a7b7-0cf5f2a4ef25' AND status = 'ativa';

UPDATE device_status 
SET is_recording = false, is_monitoring = false 
WHERE user_id = '1edfc5e3-f28d-4f42-b491-105945fa7e13';
