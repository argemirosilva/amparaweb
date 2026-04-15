

## Plano: Mudar o tom da analise de IA para falar diretamente com a usuaria

### Problema
Os prompts MICRO e MACRO falam da mulher na terceira pessoa ("a mulher", "a vitima", "identificados xingamentos direcionados"). Quem le é a propria mulher, entao o texto precisa se dirigir a ela diretamente ("voce", "na sua gravacao foram identificados...").

### O que mudar

**Arquivo:** `supabase/functions/_shared/buildAnalysisPrompt.ts`

**1. Prompt MICRO (buildAnalysisPrompt) - 3 ajustes:**
- No campo `resumo_contexto`: mudar de "Descricao neutra" para instrucao de escrever em segunda pessoa, dirigindo-se a usuaria ("Nesta conversa, voce...")
- No campo `orientacoes_vitima`: ja usa "considere/procure" mas adicionar instrucao explicita: "Dirija-se diretamente a usuaria usando 'voce'. NUNCA use terceira pessoa como 'a mulher', 'a vitima' ou 'ela'."
- No campo `justificativa_risco`: mesma regra de segunda pessoa

**2. Prompt MACRO (buildMacroPrompt) - 3 ajustes:**
- No `panorama_narrativo`: instrucao para usar segunda pessoa ("Nas suas gravacoes recentes, voce...")
- No `resumo`: dirigir-se a usuaria
- Nas `orientacoes`: ja usa tom adequado, reforcar a segunda pessoa

**3. Regra global adicionada aos dois prompts:**
Adicionar no inicio das instrucoes:
```
LINGUAGEM OBRIGATORIA:
- Dirija-se SEMPRE diretamente a usuaria usando "voce".
- NUNCA use terceira pessoa ("a mulher", "a vitima", "ela").
- Exemplo correto: "Nesta conversa, voce foi alvo de xingamentos."
- Exemplo errado: "A mulher foi alvo de xingamentos."
```

### Arquivos editados
- `supabase/functions/_shared/buildAnalysisPrompt.ts` - Ajustar os 3 prompts (triagem, MICRO, MACRO)
- Deploy das edge functions que usam esse shared: `analysis-worker`, `process-recording`, `run-batch-analysis`, `segment-triage`

### Nota
Apos o deploy, as novas analises ja sairao em segunda pessoa. As analises existentes manterao o texto antigo ate serem reprocessadas.

