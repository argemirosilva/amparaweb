

## Plano: Mover legenda de níveis para dentro do card de Acionamentos

**O que muda:**

1. **`src/components/configuracoes/AcionamentosCard.tsx`** — Adicionar o conteúdo colapsável dos níveis de alerta (Grave/Crítico) ao final do card, após as seções de switches existentes.

2. **`src/pages/Configuracoes.tsx`** — Remover o `<NiveisAlertaLegenda />` como componente separado, já que estará embutido no `AcionamentosCard`.

O conteúdo explicativo (card amarelo "Grave", card vermelho "Crítico") será renderizado como um `<Collapsible>` dentro do `AcionamentosCard`, com um trigger "Entenda os Níveis de Alerta" no final da seção.

