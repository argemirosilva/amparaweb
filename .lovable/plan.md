

## Alteracoes no Gerador de Audios

### 1. Novo limite de 2000 no seletor de quantidade
**Arquivo:** `src/pages/admin/AdminGeradorAudios.tsx`
- Adicionar opcao `<SelectItem value="2000">2000</SelectItem>` no seletor de batch size.

### 2. Analise de IA inline apos cada geracao
**Arquivo:** `supabase/functions/admin-audio-auto/index.ts`
- Na funcao `processItem`, apos inserir a gravacao na tabela `gravacoes` (passo 10), executar imediatamente a analise de IA usando `buildAnalysisPrompt` e inserir o resultado em `gravacoes_analises`.
- Isso elimina a necessidade de rodar batch analysis separadamente para audios autogerados.
- A analise sera fire-and-forget dentro do processItem (se falhar, nao impede o item de ser marcado como "done").

### 3. Novos topicos de violencia sexual velada (5%)
**Arquivo:** `supabase/functions/admin-audio-auto/index.ts`
- Criar array `TOPICS_VIOLENCIA_SEXUAL_VELADA` com ~10 topicos de coercao sexual sutil (marido pressiona, insiste, chantageia emocionalmente para ter relacoes).
- Exemplos: "marido insiste em relacoes apos ela dizer nao", "pressao sexual disfarçada de carinho", "chantagem emocional para sexo", etc.

### 4. Novos topicos de estupro conjugal inconsciente (2%)
**Arquivo:** `supabase/functions/admin-audio-auto/index.ts`
- Criar array `TOPICS_ESTUPRO_INCONSCIENTE` com ~5 topicos onde a mulher descobre ou percebe que o marido teve relacoes com ela enquanto estava inconsciente por alcool ou medicamento.

### 5. Logica de selecao de modo com novas categorias
**Arquivo:** `supabase/functions/admin-audio-auto/index.ts`
- Na funcao `generateScript`, quando `audioMode === "violencia"`:
  - 5% → `TOPICS_VIOLENCIA_SEXUAL_VELADA` (prompt especifico para coercao sexual sutil)
  - 2% → `TOPICS_ESTUPRO_INCONSCIENTE` (prompt especifico para descoberta de abuso sexual inconsciente)
  - 15% → `TOPICS_MULHER_EXTRAPOLA` (ja existente)
  - 78% → `TOPICS_VIOLENCIA` (violencia padrao)
- Cada nova categoria tera um prompt dedicado com instrucoes especificas para o tom e conteudo do dialogo.

### Detalhes Tecnicos

**Analise inline no processItem:**
```text
Apos inserir gravacao:
1. Chamar buildAnalysisPrompt(supabase)
2. Enviar transcricao para AI gateway
3. Parsear resultado JSON
4. Inserir em gravacoes_analises
5. Log do nivel_risco detectado
6. Se falhar, apenas logar erro (nao bloqueia o item)
```

**Distribuicao de probabilidade no generateScript:**
```text
roll < 0.02  → estupro_inconsciente
roll < 0.07  → violencia_sexual_velada  (0.02 + 0.05)
roll < 0.22  → mulher_extrapola         (0.07 + 0.15)
else         → violencia padrao          (~78%)
```

