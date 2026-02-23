

## Alinhar primeira data ao início do gráfico

### Problema
O componente `XAxis` do Recharts adiciona padding interno por padrao, deslocando o primeiro ponto de dados para a direita em vez de posiciona-lo no inicio do grafico.

### Solucao
Adicionar `padding={{ left: 0, right: 0 }}` ao componente `XAxis` no `RiskEvolutionCard.tsx`. Isso forca o primeiro ponto a comecar no limite esquerdo e o ultimo ponto a terminar no limite direito do grafico.

### Detalhes tecnicos

**Arquivo:** `src/components/dashboard/RiskEvolutionCard.tsx`

Adicionar a propriedade `padding` ao `XAxis` existente (linha ~140):

```tsx
<XAxis
  dataKey="date"
  padding={{ left: 0, right: 0 }}
  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
  tickLine={false}
  axisLine={false}
  // ... resto das props existentes
/>
```

Essa e uma mudanca de uma unica linha que resolve o alinhamento visual.

