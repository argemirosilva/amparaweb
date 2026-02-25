

## Analise Unificada com Abordagem Psicologica Sutil

### Objetivo
Enriquecer os prompts de IA que geram os relatorios exibidos no card "Como estou?" (MacroReportCard) e no Relatorio de Saude com tecnicas de psicologia aplicadas de forma natural e acolhedora, sem que a usuaria perceba que esta recebendo orientacao psicologica formal.

### O que muda
Tres prompts de IA serao atualizados para incorporar tecnicas psicologicas de forma invisivel:

1. **Prompt MACRO** (analysis-worker) - o "Como estou?" no card de risco
2. **Prompt do Relatorio de Saude** (web-api, `getRelatorioSaude`)
3. **Prompt MICRO** (buildAnalysisPrompt) - orientacoes individuais por gravacao

### Tecnicas psicologicas a incorporar (sem nomea-las)

- **Validacao emocional**: reconhecer e legitimar sentimentos antes de orientar
- **Reenquadramento cognitivo**: ajudar a ver a situacao de outro angulo sem invalidar
- **Psicoeducacao sutil**: explicar dinamicas de poder e ciclos sem usar termos tecnicos
- **Perguntas reflexivas**: incluir questionamentos que promovam auto-reflexao
- **Normalizacao**: "e comum sentir isso..." para reduzir culpa e vergonha
- **Fortalecimento de auto-eficacia**: destacar acoes positivas que ela ja tomou
- **Tecnica do espelho**: refletir de volta o que ela demonstrou sentir
- **Ancoragem em recursos internos**: lembrar de forcas e capacidades proprias
- **Reducao de dissonancia**: ajudar a alinhar percepcao com realidade sem confronto

### Detalhes tecnicos

**Arquivo 1: `supabase/functions/analysis-worker/index.ts`** (linhas 423-446)

Atualizar o `macroPrompt` na funcao `runMacro` para incluir instrucoes de abordagem psicologica sutil:

- No `panorama_narrativo`: comece validando sentimentos, use reenquadramento cognitivo, normalize experiencias, reflita forcas que a usuaria demonstrou (ex: "o fato de voce estar monitorando mostra coragem")
- Nas `orientacoes`: use linguagem que promova auto-reflexao ("voce ja percebeu que...", "vale se perguntar..."), fortaleca auto-eficacia, sugira acoes como se fossem insights naturais
- Adicionar campo `reflexao_pessoal`: 1-2 perguntas reflexivas sutis que a usuaria pode ponderar
- Instrucao explicita: "NUNCA use termos como 'terapia cognitiva', 'reenquadramento', 'psicoeducacao', 'tecnica psicologica' ou qualquer jargao clinico. Fale como uma amiga sabia e experiente."

**Arquivo 2: `supabase/functions/web-api/index.ts`** (linhas 1607-1642)

Atualizar o `aiPrompt` na acao `getRelatorioSaude`:

- Instrucoes adicionais para o `panorama_narrativo`: validar emocionalmente, normalizar, destacar recursos internos
- Instrucoes para `explicacao_emocional`: usar tecnica do espelho, psicoeducacao sutil sobre dinamicas relacionais
- Instrucoes para `orientacoes`: incluir perguntas reflexivas embutidas, fortalecer auto-eficacia, reduzir culpa

**Arquivo 3: `supabase/functions/_shared/buildAnalysisPrompt.ts`** (linhas 82-88)

Atualizar as instrucoes de `orientacoes_vitima` no prompt micro:

- Adicionar: "Antes de orientar, valide o sentimento. Normalize a experiencia. Destaque algo positivo que a mulher fez ou demonstrou. Inclua uma pergunta reflexiva sutil."

**Arquivo 4: `src/components/gravacoes/MacroReportCard.tsx`**

- Adicionar exibicao do novo campo `reflexao_pessoal` (se presente no output_json) como um bloco suave com icone de coracao/pensamento
- Atualizar a interface `MacroReport.output_json` para incluir `reflexao_pessoal?: string[]`

### Exemplo de output antes vs depois

**Antes (orientacao):**
> "Considere buscar ajuda profissional para lidar com a situacao."

**Depois (com psicologia sutil):**
> "Voce demonstrou muita coragem ao registrar essas conversas -- isso mostra que voce reconhece seu valor. Pode ser util se perguntar: 'o que eu faria de diferente se uma amiga querida estivesse vivendo isso?' As vezes, nos dedicamos aos outros mais do que a nos mesmas, e voce merece o mesmo cuidado."

**Antes (panorama):**
> "Nos ultimos 30 dias foram detectados padroes de violencia psicologica."

**Depois (com psicologia sutil):**
> "Nos ultimos 30 dias, os registros mostram uma situacao que pode gerar muita confusao emocional -- e completamente normal sentir-se dividida ou ate questionar sua propria percepcao. O fato de voce estar acompanhando isso ja e um passo importante. Os padroes indicam comportamentos que tendem a minar sua confianca aos poucos, algo que acontece de forma tao gradual que muitas vezes so percebemos quando ja estamos exaustas."

### Resumo de arquivos alterados

| Arquivo | Tipo de alteracao |
|---|---|
| `supabase/functions/analysis-worker/index.ts` | Prompt macro enriquecido |
| `supabase/functions/web-api/index.ts` | Prompt relatorio saude enriquecido |
| `supabase/functions/_shared/buildAnalysisPrompt.ts` | Prompt micro orientacoes enriquecido |
| `src/components/gravacoes/MacroReportCard.tsx` | Exibir campo `reflexao_pessoal` |

