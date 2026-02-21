
# Grafico de Evolucao de Risco -- Mais Integrado

## Situacao Atual
- O grafico usa uma cor lilac fixa (`hsl(270, 35%, 62%)`) que funciona bem mas esta um pouco "solto" da identidade visual
- O card usa `ampara-card` mas o grafico interno nao aproveita o gradiente da marca
- O eixo X com datas e o tooltip parecem genericos

## Proposta: Integrar com o Gradiente Ampara

### 1. Cor do grafico usando o gradiente da marca
Trocar a cor solida lilac por um **gradiente horizontal** que vai do magenta (`hsl(316, 72%, 48%)`) ao roxo (`hsl(270, 60%, 42%)`), que e exatamente o `--ampara-gradient` da marca. Isso faz o grafico "pertencer" visualmente ao app.

- A linha (stroke) usaria o roxo brand
- O preenchimento (fill) usaria um gradiente vertical do roxo brand com opacidade suave

### 2. Linha mais fina e suave
Reduzir `strokeWidth` de 2 para 1.5 e usar `type="natural"` em vez de `"monotone"` para curvas mais organicas.

### 3. Remover eixo X
Esconder as datas do eixo X (ja aparecem no tooltip ao tocar) para um visual mais limpo e minimalista, tipo um "sparkline" elegante.

### 4. Tooltip mais refinado
Usar bordas arredondadas maiores e um leve fundo com o gradiente suave da marca (`--ampara-gradient-soft`).

### 5. Dot ativo com brilho
Adicionar um leve `filter: drop-shadow` no ponto ativo para dar destaque sutil.

---

## Detalhes Tecnicos

### Arquivo: `src/components/dashboard/RiskEvolutionCard.tsx`

**Mudancas:**

1. Substituir `CHART_COLOR` por duas constantes brand:
```text
const CHART_STROKE = "hsl(270, 60%, 42%)"   // --ampara-purple
const CHART_ACCENT = "hsl(316, 72%, 48%)"   // --ampara-magenta
```

2. Atualizar o `<linearGradient>` do fill para usar as cores brand com opacidade muito suave (0.15 -> 0.01), mantendo elegancia.

3. Adicionar um segundo `<linearGradient>` horizontal para o stroke, criando efeito de gradiente na linha.

4. Esconder o `<XAxis>` (remover ou `hide`).

5. Mudar `type="monotone"` para `type="natural"` no `<Area>`.

6. Reduzir `strokeWidth` para 1.5.

7. Atualizar tooltip para usar classes `rounded-lg` e cores brand no texto.

8. Atualizar `activeDot` com fill da cor brand.

Nenhum outro arquivo precisa ser alterado.
