-- Enable Realtime for device_status, gravacoes, and alertas_panico
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gravacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_panico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.localizacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monitoramento_sessoes;