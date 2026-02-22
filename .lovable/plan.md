

## Melhoria do Prompt de Analise de IA

### Problema Identificado

O prompt atual faz uma boa analise superficial, mas falta profundidade em cenarios de **manipulacao sutil**, como:
- Uso dos filhos como moeda de troca ou instrumento de pressao
- Acusacoes sem provas repetidas para desestabilizar emocionalmente
- Declaracoes de amor/paz usadas como ferramenta de controle ("eu te amo" estando separados)
- Ameacas veladas disfarçadas de "preocupacao" ou "conselho"
- Instrumentalizacao de processos juridicos como intimidacao

### Solucao

Atualizar o prompt na tabela `admin_settings` e adicionar novos campos ao JSON de retorno, alem de exibir esses dados no card de analise.

### Mudancas no Prompt

Adicionar duas novas secoes ao prompt:

1. **Analise de Taticas Manipulativas** - Uma secao especifica para detectar e nomear taticas como:
   - Instrumentalizacao dos filhos (usar guarda/bem-estar como ameaca)
   - Falsas demonstracoes de afeto (declarar amor para manter controle)
   - Ameacas juridicas veladas (mencionar advogado, juiz, justica sem contexto real)
   - Acusacoes sem evidencias (boatos, "ouvi dizer", difamacao indireta)
   - Gaslighting (negar intencoes claras, "voce que ta exagerando")
   - Vitimizacao reversa (se colocar como a parte prejudicada)

2. **Orientacoes para a Mulher** - Um campo novo no JSON com orientacoes praticas e acolhedoras baseadas no conteudo da ligacao, como:
   - Alertas sobre o que foi identificado ("Ele pode estar usando os filhos como pressao")
   - Sugestoes de acao ("Documente essas acusacoes por escrito", "Converse com sua advogada sobre alienacao parental")
   - Frases de validacao ("Voce tem o direito de se sentir ameacada por esse tipo de conversa")

### Novos campos no JSON de retorno

```text
{
  ...campos existentes...,
  "taticas_manipulativas": [
    {
      "tatica": "instrumentalizacao_filhos",
      "descricao": "Marcos usa a preocupacao com os filhos como pretexto para ameaçar com açoes judiciais",
      "evidencia": "minha advogada me disse que...",
      "gravidade": "alta"
    }
  ],
  "orientacoes_vitima": [
    "Registre por escrito todas as vezes que ele menciona justica ou advogado em contexto de ameaca",
    "Acusacoes baseadas em 'ouvi dizer' nao tem validade legal sem provas concretas",
    "Voce nao precisa aceitar esse tipo de pressao como 'preocupacao'"
  ],
  "sinais_alerta": ["uso de filhos como barganha", "ameaca juridica velada", "falsa demonstracao de afeto"]
}
```

### Mudancas nos Arquivos

1. **Migracao SQL** - Atualizar o valor do prompt na tabela `admin_settings` com o texto aprimorado incluindo as novas secoes de taticas manipulativas e orientacoes.

2. **`supabase/functions/process-recording/index.ts`** - Atualizar o prompt fallback embutido para incluir as mesmas melhorias.

3. **`supabase/functions/run-batch-analysis/index.ts`** - Atualizar o prompt default embutido.

4. **`supabase/functions/admin-audio-auto/index.ts`** - Atualizar o prompt default embutido.

5. **`src/components/dashboard/AnaliseCard.tsx`** - Adicionar exibicao dos novos campos:
   - Secao "Taticas Manipulativas" com badges por tipo e descricao
   - Secao "Orientacoes" com lista de recomendacoes para a vitima
   - Secao "Sinais de Alerta" com badges visuais

### Detalhes Tecnicos

- O prompt sera atualizado via SQL na tabela `admin_settings` (chave `ia_prompt_analise`)
- Os campos `taticas_manipulativas`, `orientacoes_vitima` e `sinais_alerta` ficam dentro do `analise_completa` (JSONB), sem necessidade de novas colunas
- O `AnaliseCard` sera atualizado para ler esses novos campos do `analise_completa`
- Apos aprovar, sera necessario reprocessar as analises existentes para aplicar o novo prompt
- As edge functions serao redeployadas automaticamente

