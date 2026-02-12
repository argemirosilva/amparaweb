
# Card de Periodo de Monitoramento

## Objetivo
Reescrever o `MonitoringStatusCard` para exibir de forma clara o estado do monitoramento com tres cenarios distintos:

1. **Monitorando** -- quando o horario atual esta dentro de um periodo agendado. Exibe "Monitorando" com o intervalo (ex: "08:00 - 12:00") em destaque verde.
2. **Proximo periodo** -- quando nao esta monitorando mas ainda ha um periodo agendado para mais tarde no mesmo dia. Exibe "Inicia o monitoramento as XX:XX".
3. **Fora do periodo** -- quando nao ha mais nenhum periodo restante para o dia. Exibe "Fora do periodo de monitoramento".

## Visual
- Mantemos o estilo `ampara-card` existente, com o `GradientIcon` do escudo.
- Estado ativo: badge/texto em verde (emerald) com o intervalo do periodo.
- Estado proximo: texto em amarelo/amber com o horario do proximo periodo.
- Estado fora: texto em cinza (muted).

## Detalhes Tecnicos

### Arquivo: `src/components/dashboard/MonitoringStatusCard.tsx`
Reescrever a logica do componente:

- Buscar `agendamentos_monitoramento.periodos_semana` para o usuario.
- Determinar o dia da semana atual e extrair os periodos do dia.
- Comparar o horario atual (HH:MM) com cada periodo:
  - Se `nowMin >= inicio && nowMin < fim` --> estado "monitorando", exibir intervalo.
  - Senao, filtrar periodos com `inicio > nowMin` e ordenar. Se houver --> estado "proximo", exibir horario.
  - Se nenhum periodo restante --> estado "fora".
- Tambem buscar sessao ativa em `monitoramento_sessoes` (como ja faz) para complementar -- se houver sessao ativa com `window_start_at`/`window_end_at`, usar esses valores como o periodo exibido.
- Adicionar realtime subscription na tabela `monitoramento_sessoes` para atualizar em tempo real quando uma sessao iniciar/encerrar.

### Arquivo: `src/pages/Home.tsx`
- Importar e adicionar o `MonitoringStatusCard` na lista de cards, posicionado antes do `DeviceStatusCard`.

### Renderizacao por estado

**Monitorando:**
```
[Shield] Monitoramento
         Monitorando · 08:00 - 12:00    (texto verde)
```

**Proximo periodo:**
```
[Shield] Monitoramento
         Inicia o monitoramento as 14:00  (texto amber)
```

**Fora do periodo:**
```
[Shield] Monitoramento
         Fora do periodo de monitoramento  (texto cinza)
```
