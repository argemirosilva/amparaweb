-- Add xingamentos field to gravacoes_analises to store insults per recording
ALTER TABLE public.gravacoes_analises 
ADD COLUMN IF NOT EXISTS xingamentos text[] DEFAULT '{}';

-- Add xingamentos_frequentes to agressores to accumulate insults over time  
ALTER TABLE public.agressores
ADD COLUMN IF NOT EXISTS xingamentos_frequentes text[] DEFAULT '{}';
