

# Redesign da Interface de Curadoria

## Problemas Atuais

1. **Tabela da listagem muito esparsa** -- apenas 4 colunas (data, risco, sentimento, curada), sem resumo ou preview do conteudo
2. **Drawer com 6 abas fragmentadas** -- o curador precisa navegar entre Geral, Risco, Sentimento, Taticas, Ciclo e JSON para avaliar um unico registro, tornando o processo lento
3. **Sem indicador de progresso** -- nao ha como saber quantos campos ja foram avaliados em cada registro
4. **Informacoes repetidas** -- o resumo e transcricao ocupam muito espaco na aba Geral, empurrando os campos de avaliacao para baixo

## Solucao Proposta

### 1. Tabela de listagem enriquecida

Adicionar colunas uteis para triagem rapida:

| Data/hora | Duracao | Risco | Contexto | Progresso | Curada |
|---|---|---|---|---|---|
| 24/02 14:30 | 3m20s | [critico] | Padrao abuso | 5/8 campos | [x] |

- **Risco** com badge colorido (ja existe as cores, so nao usa na tabela)
- **Progresso**: barra ou texto "X/8 campos avaliados" para cada registro
- **Duracao**: mostra o tempo da gravacao
- **Contexto**: classificacao de contexto resumida

### 2. Drawer reorganizado em 2 secoes (em vez de 6 abas)

Substituir as 6 abas por um layout de 2 abas mais logicas:

**Aba "Transcricao"**
- Header compacto com metadata (data, duracao, risco badge, sentimento, contexto)
- Transcricao com baloes e sistema de curadoria inline (ja existente)
- Resumo anonimizado colapsavel
- Palavras-chave e xingamentos

**Aba "Avaliacao"**
- Todos os 8 campos de avaliacao em uma unica lista vertical organizada por secoes visuais:
  - **Secao "Classificacao"**: Nivel de Risco, Sentimento, Classificacao de Contexto
  - **Secao "Deteccao"**: Taticas Manipulativas, Sinais de Alerta, Categorias
  - **Secao "Ciclo"**: Fase do Ciclo, Tipos de Violencia
- Barra de progresso no topo: "5 de 8 campos avaliados"
- Botao "Marcar como curada" fixo no rodape

**Aba "JSON"** (mantida para debug)

### 3. Barra de progresso visual

No drawer, exibir um indicador claro:

```text
+------------------------------------------+
| Progresso: [=======-----] 5/8 campos     |
+------------------------------------------+
```

Cada campo avaliado fica com um indicador visual (check verde ou X vermelho) ao lado do titulo.

### 4. Header compacto no drawer

Em vez de espalhar metadata pela aba Geral, concentrar tudo em um header fixo:

```text
+--------------------------------------------------+
| 24/02/2026 14:30  |  3m20s  |  [CRITICO]  | Neg  |
| Contexto: Padrao consistente de abuso             |
+--------------------------------------------------+
```

## Detalhes Tecnicos

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/pages/admin/AdminCuradoria.tsx` | Adicionar colunas na tabela (duracao, contexto, progresso com badge colorido) |
| `src/components/curadoria/CuradoriaDetailDrawer.tsx` | Reorganizar de 6 abas para 2+1 (Transcricao, Avaliacao, JSON). Adicionar header compacto e barra de progresso. Mover botao "Marcar como curada" para footer fixo |
| `src/components/curadoria/CampoAvaliacao.tsx` | Adicionar indicador de status no header do card (icone check/X) com visual mais compacto |

### Logica de progresso

O progresso sera calculado a partir das avaliacoes ja salvas:

```text
const camposAvaliados = CAMPOS_AVALIAVEIS.filter(c => avaliacoes[c]?.status !== "pendente").length;
const progresso = camposAvaliados / CAMPOS_AVALIAVEIS.length;
```

Na tabela da listagem, o backend ja retorna os dados necessarios -- sera necessario adicionar uma contagem de avaliacoes por analise na query `listCuradoria` do admin-api (campo `avaliacoes_count`).

### Mudancas no admin-api

Adicionar o campo `avaliacoes_count` na resposta de `listCuradoria` para exibir o progresso na tabela sem precisar de uma query extra por registro.

