
# Adicionar Seletor de Dados no Ranking do Mapa Admin

## O que muda

A sidebar direita do mapa atualmente mostra apenas "Ranking por UF -- Gravacoes". Sera adicionado um seletor com 3 opcoes para alternar os dados exibidos no ranking:

1. **Gravacoes** (atual) -- ordenado por numero de gravacoes
2. **Indice de Risco** -- ordenado por quantidade de analises com risco alto/critico
3. **Acionamento de Panico** -- ordenado por numero de alertas de panico

## Detalhes

### Novo estado e dados

- Novo state `rankingMode`: `"gravacoes" | "risco" | "panico"` (default: `"gravacoes"`)
- Novo state `ufRiskStats`: contagem de analises por nivel de risco por UF (agregado de `gravacoes_analises`)
- Novo state `ufPanicoStats`: contagem de alertas de panico por UF (agregado de `alertas_panico` no periodo)

### Busca de dados adicionais (dentro do `fetchData` existente)

- **Risco por UF**: query em `gravacoes_analises` com `nivel_risco` e `user_id`, cruzando com `userMap` para obter a UF. Agrega contagem total e contagem de alto+critico por UF.
- **Panico por UF**: query em `alertas_panico` (todos no periodo, nao so ativos), cruzando `user_id` com `userMap` para UF. Agrega contagem total por UF.

### Seletor visual

Tres botoes pequenos (estilo similar aos botoes de periodo) logo acima da lista de ranking:

```text
  [Gravacoes]  [Risco]  [Panico]
```

### Conteudo do ranking por modo

**Gravacoes** (atual, sem mudancas):
- Ordena por `s.gravacoes`
- Mostra valor numerico + seta de tendencia

**Risco**:
- Ordena por contagem de analises alto+critico
- Mostra: "X alto/critico" com badge colorido

**Panico**:
- Ordena por total de acionamentos
- Mostra: "X acionamentos"

### Ranking por municipio (quando UF selecionada)

O mesmo seletor aparece na visao de municipio. Quando risco ou panico estiver selecionado, ordena os municipios pelo criterio correspondente.

### Dados necessarios por modo (municipio)

- Risco por municipio: mesma query de `gravacoes_analises`, agrupando por cidade do usuario
- Panico por municipio: mesma query de `alertas_panico`, agrupando por cidade do usuario

## Arquivo modificado

- `src/pages/admin/AdminMapa.tsx` -- adicao de states, queries no fetchData, seletor visual e logica de ordenacao no ranking

## Sem alteracoes de banco de dados

Todas as tabelas necessarias (`gravacoes_analises`, `alertas_panico`) ja possuem as politicas de leitura corretas.
