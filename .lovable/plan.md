

# Setas de Tendencia nos Mapas -- Admin e Transparencia

## O que muda

Cada estado no mapa passa a exibir, alem da sigla e contagem, uma seta indicando tendencia:
- **Seta vermelha para cima** -- estado com ocorrencias crescendo
- **Seta verde para baixo** -- estado com ocorrencias diminuindo
- Sem seta quando nao ha dados suficientes ou a variacao e insignificante

## Como calcular a tendencia

Dividir o periodo selecionado ao meio (ex: 90 dias = 45 dias recentes vs 45 dias anteriores). Comparar a contagem de eventos em cada metade por UF:
- Se a metade recente tem 20%+ a mais de eventos que a anterior: **crescendo**
- Se a metade recente tem 20%- a menos: **decaindo**
- Caso contrario: **estavel** (sem seta)

## Detalhes Tecnicos

### 1. `src/pages/admin/AdminMapa.tsx`

**No `fetchData`:**
- Buscar `gravacoes_analises.created_at` e `user_id` para o periodo completo (ja faz isso em `loadAnalytics`)
- Calcular por UF: `eventosRecentHalf` vs `eventosOlderHalf`
- Armazenar `ufTrend: Record<string, "up" | "down" | "stable">` em novo state

**No choropleth/labels `useEffect`:**
- Enriquecer `labelFeatures` com propriedade `trend` ("up" / "down" / "stable")
- Alterar o `text-field` do layer `state-labels-layer` para incluir seta Unicode:
  - Up: `\u2191` (cor vermelha via segundo label layer)
  - Down: `\u2193` (cor verde via segundo label layer)
- Como Mapbox symbol layers nao suportam cores diferentes por caracter, adicionar um **segundo symbol layer** (`state-trend-layer`) posicionado logo abaixo do label principal com:
  - `text-field`: apenas a seta (filtrado por trend != stable)
  - `text-color`: vermelho para up, verde para down (via expression)
  - `text-offset`: deslocado para baixo do label principal

### 2. `src/pages/transparencia/TransparenciaMapa.tsx`

Mesma logica aplicada:
- No `loadStats`: dividir os eventos por metade do periodo e calcular trend por UF
- Novo state `ufTrends`
- No choropleth `useEffect`: adicionar propriedade `trend` aos `labelFeatures` e criar segundo layer de setas

### Novo layer de setas (ambos mapas)

```text
Layer: "state-trend-layer"
Type: symbol
Source: "state-labels" (mesma source, ja tem o ponto central)
Layout:
  text-field: [case, ["==", ["get","trend"], "up"], "▲", ["==", ["get","trend"], "down"], "▼", ""]
  text-size: 12
  text-offset: [0, 1.2]  (abaixo do label principal)
  text-allow-overlap: true
Paint:
  text-color: [case, ["==", ["get","trend"], "up"], "#dc2626", "#16a34a"]
  text-halo-color: white
  text-halo-width: 1.5
Filter: ["!=", ["get","trend"], "stable"]
```

### Arquivos afetados

- `src/pages/admin/AdminMapa.tsx` -- novo state `ufTrends`, calculo de tendencia no fetch, novo layer de setas
- `src/pages/transparencia/TransparenciaMapa.tsx` -- idem

### Nenhuma alteracao no backend

Todos os dados necessarios ja existem nas tabelas `gravacoes_analises` e `alertas_panico`.

