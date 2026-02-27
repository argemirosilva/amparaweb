

# Recalculo Periodico do Perfil de Risco dos Agressores

## Objetivo
Criar um job agendado (cron) que roda a cada 7 dias e recalcula o `violence_profile_probs`, `risk_score`, `risk_level` e `flags` de todos os agressores com base nos incidentes acumulados. Isso garante que os dados exibidos na busca estejam sempre atualizados, mesmo sem novas buscas ou incidentes.

## Como funciona hoje
A funcao `recalculateAgressorRisk` ja existe em `web-api/index.ts` e recalcula o perfil de um agressor individual. Porem, ela so e chamada quando um novo incidente e registrado (`reportIncident`). Se nenhum incidente novo for adicionado, os dados ficam congelados.

## Mudancas

### 1. Criar edge function `recalculate-aggressors/index.ts`
- Busca todos os agressores que possuem ao menos 1 incidente
- Para cada agressor, executa a mesma logica de `recalculateAgressorRisk` (copiada/adaptada para funcionar de forma independente)
- Registra no `audit_logs` o total de agressores atualizados
- Protegida: so executa se chamada via cron (sem necessidade de sessao de usuario)

### 2. Registrar cron job no banco
- Usar `pg_cron` + `pg_net` para agendar a chamada da edge function a cada 7 dias (domingos as 04:00 UTC)
- Formato: `0 4 * * 0` (todo domingo as 04h)

### 3. Adicionar ao `config.toml`
- Registrar `[functions.recalculate-aggressors]` com `verify_jwt = false`

## Detalhes Tecnicos

A nova edge function:

```text
1. Busca todos os IDs de agressores distintos na tabela aggressor_incidents
2. Para cada agressor_id:
   - Busca incidentes (violence_types, severity, occurred_at_month, pattern_tags, confidence)
   - Calcula violence_profile_probs, risk_score, risk_level, flags (mesma logica existente)
   - Atualiza a tabela agressores
3. Registra audit_log com { action_type: "recalculate_aggressors_cron", total, updated, errors }
```

O cron sera configurado via SQL insert (nao migration), chamando a URL da edge function com o anon key.

## Arquivos criados/modificados

1. **Criar** `supabase/functions/recalculate-aggressors/index.ts` -- edge function com a logica de recalculo em lote
2. **Atualizar** `supabase/config.toml` -- adicionar entrada da nova funcao (automatico)
3. **SQL insert** -- registrar o cron job semanal via `pg_cron`
