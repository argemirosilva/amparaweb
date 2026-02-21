

# Substituir Barras de Sentimento por Carinha Emocional Lilas

## O que muda

A secao "Saude Emocional" do Relatorio de Saude deixa de exibir barras horizontais de porcentagem (positivo/negativo/neutro/misto) e passa a mostrar uma **unica carinha SVG lilas** que representa visualmente o estado emocional da vitima, com um texto explicativo abaixo.

## Escala de Expressoes (6 niveis)

A carinha muda de expressao com base na proporcao de sentimentos negativos vs positivos nas gravacoes analisadas:

```text
Score emocional = (positivo * 2 + neutro) / (total * 2)
                  0.0 -------- 0.2 -------- 0.4 -------- 0.6 -------- 0.8 -------- 1.0

Nivel:          Em colapso    Chorando      Triste       Cansada     Tranquila    Radiante
Expressao:      Cabelos p/    Lagrimas      Boca p/      Neutra/     Sorriso      Sorrindo
                cima                        baixo        abatida     leve         aberto
```

- **Radiante** (score >= 0.8): sorriso aberto, olhos felizes
- **Tranquila** (score >= 0.6): sorriso leve, expressao calma
- **Cansada** (score >= 0.4): boca reta, olhos semi-cerrados
- **Triste** (score >= 0.25): boca para baixo, olhos tristes
- **Chorando** (score >= 0.1): lagrimas, boca tremula
- **Em colapso** (score < 0.1): cabelos para cima, olhos arregalados, boca aberta

Bonus: se houver alertas de panico no periodo, o score e penalizado para refletir a gravidade.

## Layout visual

```text
+-------------------------------------------+
|  [icone Heart]  SAUDE EMOCIONAL           |
|                                           |
|          (  carinha SVG lilas  )           |
|              64x64 pixels                 |
|                                           |
|          "Cansada"  (label)               |
|                                           |
|  "Nos ultimos 30 dias, as gravacoes       |
|   mostram predominancia de momentos       |
|   de tensao e desgaste emocional..."      |
|   (texto da IA - explicacao_emocional)    |
+-------------------------------------------+
```

## Detalhes tecnicos

### Arquivo a criar
- `src/components/dashboard/EmotionalFaceIcon.tsx` -- componente que recebe o score (0-1) e renderiza o SVG correspondente em lilas. Cada expressao e desenhada com paths SVG inline (circulo para rosto, arcos para boca, circulos para olhos, linhas para lagrimas/cabelos). Cor principal: `hsl(263, 70%, 58%)` (lilas Ampara).

### Arquivo a modificar
- `src/components/dashboard/RelatorioSaudeContent.tsx`:
  - Remover o componente `SentimentBar` (barras horizontais)
  - Substituir pela carinha centralizada usando `EmotionalFaceIcon`
  - Calcular o score emocional a partir de `relatorio.sentimentos`
  - Mostrar o label do nivel abaixo da carinha
  - Manter o texto `explicacao_emocional` da IA abaixo

### Calculo do score (no frontend)

```text
const { positivo = 0, negativo = 0, neutro = 0, misto = 0 } = relatorio.sentimentos;
const total = positivo + negativo + neutro + misto;
const score = total > 0 ? (positivo * 2 + neutro) / (total * 2) : 0.5;
// Penalizar se houver alertas de panico
const adjusted = relatorio.periodo.total_alertas > 0
  ? Math.max(0, score - 0.15)
  : score;
```

### SVG das carinhas

Cada nivel tem paths SVG distintos:
- Rosto: circulo com fill lilas claro e stroke lilas
- Olhos: circulos ou arcos dependendo da expressao
- Boca: arco (sorriso), linha reta (neutra), arco invertido (triste), ondulada (chorando)
- Extras: lagrimas (gotas para chorando), cabelos em pe (linhas para colapso)
- Tamanho: 64x64 com viewBox padronizado

### Sem mudancas no backend
O payload do relatorio ja contem `sentimentos` e `explicacao_emocional`. Nenhuma alteracao necessaria na action `getRelatorioSaude`.

