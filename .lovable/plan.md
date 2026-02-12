

# Atualizar Prompt do Gemini no Risk Engine

## O que muda

Substituir o prompt de sistema atual (generico e curto) na funcao `computeRiskWithGemini` pelo prompt detalhado fornecido, que inclui:

- Metodologia de pesos por tipo de evento (panic_activated: +20, coercion: +25, etc.)
- Regras de calculo de tendencia (media dos primeiros 30% vs ultimos 30%)
- Faixas de nivel: 0-25 Baixo, 26-50 Moderado, 51-75 Alto, 76-100 Critico
- Regras de auto-escalada para Critico (coercao + ameaca + arma, descumprimento de medida protetiva)
- Instrucoes para fatores principais (3-6 itens, linguagem tecnica e curta)
- Conduta: nao inventar fatos, nao inserir dados pessoais

## Alteracoes

### Arquivo: `supabase/functions/web-api/index.ts`

**1. Substituir `systemPrompt` (linhas 862-872)**

Trocar o prompt atual de ~10 linhas pelo prompt completo fornecido pelo usuario, com todas as regras de analise contextual/temporal, heuristica de pesos, calculo de tendencia, faixas de nivel e regras de auto-escalada.

**2. Atualizar `risk_level` enum no tool calling (linha 904)**

Ajustar os valores do enum para alinhar com as faixas do novo prompt:
- Remover "Sem Risco" (o prompt usa 0-25 como "Baixo")
- Manter: `["Baixo", "Moderado", "Alto", "Critico"]`

**3. Adicionar `trend_percentage` como required no schema (linha 910)**

O novo prompt define calculo especifico para trend_percentage, entao deve ser obrigatorio.

**4. Atualizar fallback default (linhas 924-931 e 942-948)**

Mudar `risk_level` default de "Sem Risco" para "Baixo" nos fallbacks de erro, alinhando com o novo prompt.

### Deploy

Redeploy da `web-api` apos as alteracoes.

## Detalhes Tecnicos

O prompt completo sera inserido como template literal no `systemPrompt`, mantendo a mesma estrutura de chamada ao Lovable AI Gateway com tool calling. Nenhuma outra parte do codigo (buildRiskHistoryPayload, cache, frontend) sera alterada.

