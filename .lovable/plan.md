

# Reorganizar Cards do Dashboard Admin

## Mudancas

**Arquivo:** `src/pages/admin/AdminMapa.tsx`

### Novo layout dos graficos:

**Linha 1 — Distribuicao por Nivel de Risco + Nuvem de Palavras (lado a lado, 50/50)**
- Card "Distribuicao por Nivel de Risco" (pie chart) ocupa `lg:col-span-1`
- Card "Nuvem de Palavras" (WordCloudCard) ocupa `lg:col-span-1`
- Grid: `grid-cols-1 lg:grid-cols-2`

**Linha 2 — Evolucao Temporal + Alertas por Tipo de Acionamento (lado a lado, 50/50)**
- Card "Evolucao Temporal" (line chart) ocupa `lg:col-span-1`
- Card "Alertas por Tipo de Acionamento" (pie chart) ocupa `lg:col-span-1`
- Grid: `grid-cols-1 lg:grid-cols-2`

**Linha 3 — Atividade por Hora do Dia** (sem alteracao, full width)

**Linha 4 — Regioes com maior incidencia** (sem alteracao, full width)

### Detalhes tecnicos

1. Mover o `WordCloudCard` do final do arquivo para dentro do grid da "Distribuicao por Nivel de Risco", transformando-o em `grid-cols-1 lg:grid-cols-2`
2. Mover o card "Alertas por Tipo de Acionamento" para dentro do grid da "Evolucao Temporal", tambem `lg:grid-cols-2` (em vez do atual `lg:grid-cols-3` com 2/3 + 1/3)
3. Remover o grid antigo que continha apenas "Alertas por Tipo de Acionamento" sozinho
4. Remover o bloco `WordCloudCard` do final da pagina

