

# Tooltip no GPS com Status e Intervalo de Atualizacao

## O que muda

### 1. Hook `useDeviceStatus` -- buscar 2 ultimas localizacoes
- Alterar a query de `localizacoes` para buscar `limit(2)` em vez de `limit(1)`
- Expor um novo campo `locationInterval` (em segundos) calculado pela diferenca entre `created_at` das 2 ultimas localizacoes
- Manter `location` como a mais recente (sem breaking change)

### 2. Componente `DeviceStatusCard` -- adicionar Tooltip no GPS
- Importar `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` de `@/components/ui/tooltip`
- Envolver o botao GPS com o Tooltip
- Conteudo do tooltip:
  - **Verde (GPS recente)**: "Localizacao ativa -- atualizando a cada ~Xs"
  - **Cinza (GPS desatualizado/offline)**: "Sem atualizacao recente de GPS" com o tempo desde a ultima posicao

### Detalhes tecnicos

**`src/hooks/useDeviceStatus.ts`**:
- Query de localizacoes passa de `.limit(1).maybeSingle()` para `.limit(2)`
- Calcula intervalo: `locations[0].created_at - locations[1].created_at` em segundos
- Adiciona `locationInterval: number | null` ao retorno

**`src/components/dashboard/DeviceStatusCard.tsx`**:
- Importa componentes de Tooltip
- Envolve o botao GPS existente com `TooltipProvider > Tooltip > TooltipTrigger/TooltipContent`
- Formata intervalo: "a cada ~30s", "a cada ~1min", etc.
- Texto contextual baseado no estado (verde/cinza/vermelho)

