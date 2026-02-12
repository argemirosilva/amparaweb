

# Contador preciso com timestamps do servidor

## Objetivo
Substituir o `Date.now()` usado como referencia do contador por timestamps reais do banco de dados, para que o contador mostre o tempo correto desde o primeiro render.

## Mudancas

### 1. `src/hooks/useDeviceStatus.ts`
- Alterar a query de `alertas_panico` para trazer `id, criado_em` (atualmente so traz `id`)
- Adicionar query paralela para `monitoramento_sessoes` buscando `iniciado_em` da sessao ativa
- Adicionar query paralela para `gravacoes` buscando `created_at` da gravacao com status `pendente`
- Exportar tres novos campos: `recordingStartedAt`, `monitoringStartedAt`, `panicStartedAt`

### 2. `src/components/dashboard/DeviceStatusCard.tsx`
- Remover `recordingStartRef` e a logica que usa `Date.now()` como marco zero
- Usar os timestamps do hook (`recordingStartedAt`, `monitoringStartedAt`, `panicStartedAt`) para calcular o elapsed real
- O timer recalcula a cada segundo: `Math.floor((Date.now() - timestamp) / 1000)`

## Resultado esperado

Antes: dispositivo comeca a gravar, polling detecta apos alguns segundos, contador mostra 00:00.

Depois: polling detecta gravacao, recebe timestamp real do inicio, contador ja mostra o tempo correto (ex: 00:12).

Nenhuma migracao de banco necessaria - todos os campos ja existem nas tabelas.

