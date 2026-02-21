

# Relatorio de Saude da Relacao -- Dentro do Card de Evolucao de Risco

## O que muda

Quando a usuaria clica em "Ver detalhes da analise" no card de Evolucao de Risco no dashboard, em vez de ver apenas fatores tecnicos e resumo seco, ela vera um **relatorio completo e humanizado** sobre a saude da sua relacao, gerado por IA com base em todos os dados agregados.

## Estrutura do Relatorio (secoes visuais dentro do card expandido)

### Secao 1 -- Panorama da Relacao
- Texto narrativo humanizado (2-3 paragrafos) explicando a situacao atual em linguagem acolhedora
- Contexto temporal: "Nos ultimos X dias, observamos que..."
- Gerado pela IA com base nos dados agregados

### Secao 2 -- Saude Emocional
- Barras horizontais mostrando distribuicao de sentimentos (positivo/negativo/neutro/misto) extraidas de todas as analises do periodo
- Classificacao de contexto predominante (saudavel, rispido, abusivo, etc.)
- Texto curto da IA explicando o que isso significa

### Secao 3 -- Padroes Identificados
- Cards visuais com os tipos de violencia detectados (Psicologica, Moral, Fisica, etc.) com frequencia
- Lista de padroes recorrentes (controle, isolamento, intimidacao) com contagem
- Palavras-chave mais frequentes como tags

### Secao 4 -- Orientacoes Personalizadas
- 3-5 orientacoes praticas geradas pela IA baseadas no historico real
- Tom acolhedor e empoderador, sem jargao juridico
- Links para canais de apoio (180, delegacias)

### Secao 5 -- Fatores de Risco e Periodo
- Fatores identificados (mantidos do formato atual mas com linguagem melhor)
- Periodo coberto e total de gravacoes analisadas

## Mudancas Tecnicas

### 1. Backend -- nova action `getRelatorioSaude` em `web-api/index.ts`

Agrega dados de multiplas tabelas:
- `gravacoes_analises`: sentimentos, categorias, padroes, palavras-chave, niveis de risco (ultimos 90 dias)
- `risk_assessments`: historico de scores
- `vitimas_agressores` + `agressores`: flags do agressor (arma, forca de seguranca)
- `alertas_panico`: contagem e tipos

Chama a IA (Gemini Flash) com um prompt dedicado que recebe os dados agregados e retorna:

```text
{
  panorama_narrativo: "texto humanizado...",
  saude_emocional: {
    sentimentos: { positivo: N, negativo: N, neutro: N, misto: N },
    contexto_predominante: "rispido_nao_abusivo",
    explicacao: "texto curto..."
  },
  padroes: {
    tipos_violencia: [{ tipo, contagem }],
    padroes_recorrentes: [{ padrao, contagem }],
    palavras_frequentes: [{ palavra, contagem }]
  },
  orientacoes: ["orientacao 1", "orientacao 2", ...],
  canais_apoio: ["Central 180", "Delegacia da Mulher"]
}
```

A agregacao dos dados (contagem de sentimentos, tipos de violencia, etc.) e feita no backend antes de enviar para a IA. A IA recebe os dados ja processados e gera apenas os textos narrativos e orientacoes.

### 2. Frontend -- `RiskEvolutionCard.tsx`

- O botao "Ver detalhes da analise" passa a carregar o relatorio completo (lazy load)
- Ao expandir, faz uma chamada a `getRelatorioSaude` (com cache local no state)
- Renderiza as 5 secoes com componentes visuais simples:
  - Barras horizontais para sentimentos (div com width percentual)
  - Badges para tipos de violencia e palavras-chave
  - Texto corrido para narrativa e orientacoes
  - Icones para canais de apoio

### 3. Novo componente `RelatorioSaudeContent.tsx`

Componente dedicado para renderizar o conteudo do relatorio dentro do card expandido. Recebe o payload do backend e renderiza as secoes. Usa ScrollArea para scroll interno se o conteudo for grande.

### Arquivos a criar
- `src/components/dashboard/RelatorioSaudeContent.tsx`

### Arquivos a modificar
- `src/components/dashboard/RiskEvolutionCard.tsx` -- expandido carrega relatorio completo
- `supabase/functions/web-api/index.ts` -- nova action `getRelatorioSaude` + prompt de IA dedicado

### Sem mudancas no banco de dados
Todos os dados necessarios ja existem nas tabelas `gravacoes_analises`, `risk_assessments`, `alertas_panico`, `vitimas_agressores` e `agressores`.

