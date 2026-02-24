
# Plano: Alinhar Prompts de IA com a Tabela `tipos_alerta`

## Problema Identificado

Existem **3 desalinhamentos** entre o que a IA retorna e o que a tabela `tipos_alerta` espera:

1. **`tipos_violencia`** -- O prompt pede `fisica`, `psicologica`, `moral`, etc. (nomes curtos), mas a tabela registra `violencia_psicologica`, `violencia_fisica`, etc. (com prefixo). Quando a curadoria compara os valores, eles nao batem.

2. **`categorias`** -- O prompt lista 7 opcoes (`violencia_fisica`, `ameaca`, `coercao`, `controle`, `assedio`, `nenhuma`), mas a tabela tem 18 tipos de violencia (inclui `chantagem`, `humilhacao`, `isolamento`, etc.). A IA nao sabe que esses existem.

3. **Prompts duplicados** -- Existem 4 edge functions com prompts quase identicos, mas com pequenas divergencias entre si:
   - `process-recording` (prompt principal)
   - `run-batch-analysis` (versao resumida)
   - `analysis-worker` (versao com ciclo de violencia)
   - `admin-audio-auto` (versao resumida)

## Solucao Proposta

### Etapa 1: Unificar o prompt em um unico lugar

Criar uma funcao utilitaria compartilhada que monta o prompt dinamicamente, buscando os valores validos da tabela `tipos_alerta` no banco. Assim, qualquer tipo adicionado/removido no banco se reflete automaticamente no prompt.

**Abordagem**: Cada edge function, ao montar o prompt, fara uma query na tabela `tipos_alerta` para obter os codigos validos por grupo e injetar no template do prompt.

### Etapa 2: Atualizar o template do prompt

O prompt sera alterado para:

```text
"tipos_violencia": usar SOMENTE estes valores: [lista dinamica do grupo 'violencia']
"categorias": usar SOMENTE estes valores: [lista dinamica dos grupos 'violencia' + 'curadoria']  
"taticas_manipulativas[].tatica": usar SOMENTE estes valores: [lista dinamica do grupo 'tatica']
"nivel_risco": usar SOMENTE: [lista do grupo 'risco']
"classificacao_contexto": usar SOMENTE: [lista do grupo 'contexto']
```

### Etapa 3: Normalizar `tipos_violencia` no prompt

Mudar o prompt para que `tipos_violencia` use os mesmos codigos da tabela (`violencia_psicologica` em vez de `psicologica`). Isso elimina a necessidade de mapeamento no frontend.

Alternativa mais segura: manter o formato curto no prompt (`fisica`, `psicologica`) e adicionar um passo de normalizacao no backend apos o parse do JSON da IA, convertendo para o formato da tabela.

### Etapa 4: Aplicar em todas as 4 edge functions

Cada uma das 4 functions sera atualizada para usar a mesma funcao de montagem de prompt:

1. **`process-recording/index.ts`** -- Substituir `getAnalysisPrompt()` pela versao dinamica
2. **`run-batch-analysis/index.ts`** -- Substituir `getDefaultAnalysisPrompt()` pela versao dinamica
3. **`analysis-worker/index.ts`** -- Substituir `getMicroPrompt()` pela versao dinamica
4. **`admin-audio-auto/index.ts`** -- Substituir a funcao de prompt pela versao dinamica

### Etapa 5: Atualizar a tabela `tipos_alerta` (se necessario)

Verificar se faltam tipos que a IA ja retorna nos dados existentes e adicionar. Exemplo: o campo `categorias` no prompt atual inclui `nenhuma` -- precisamos decidir se entra na tabela ou se a IA pode retornar array vazio em vez disso.

---

## Detalhes Tecnicos

### Funcao compartilhada de montagem de prompt

Cada edge function incluira uma funcao `buildAnalysisPrompt(supabase)` que:

1. Busca `tipos_alerta` agrupados por `grupo`
2. Verifica se existe override em `admin_settings.ia_prompt_analise`
3. Se existir override, usa ele (retrocompatibilidade)
4. Se nao, monta o prompt com template + valores dinamicos

```text
// Pseudocodigo
async function buildAnalysisPrompt(supabase) {
  // 1. Tenta admin_settings override
  const override = await getAdminSetting('ia_prompt_analise');
  if (override) return override;

  // 2. Busca tipos do banco
  const tipos = await supabase.from('tipos_alerta').select('grupo, codigo').eq('ativo', true);
  
  // 3. Agrupa
  const violencia = tipos.filter(t => t.grupo === 'violencia').map(t => t.codigo);
  const taticas = tipos.filter(t => t.grupo === 'tatica').map(t => t.codigo);
  const risco = tipos.filter(t => t.grupo === 'risco').map(t => t.codigo);
  const contexto = tipos.filter(t => t.grupo === 'contexto').map(t => t.codigo);

  // 4. Injeta no template
  return TEMPLATE.replace('{TIPOS_VIOLENCIA}', violencia.join('|'))
                  .replace('{TATICAS}', taticas.join(', '))
                  // etc.
}
```

### Normalizacao pos-parse

Apos o parse do JSON da IA, adicionar um passo de normalizacao:

```text
// Se a IA retornar "fisica", converter para "violencia_fisica"
// Se retornar "violencia_fisica", manter como esta
function normalizeTipoViolencia(tipo) {
  if (tipo.startsWith('violencia_')) return tipo;
  if (tipo === 'nenhuma') return tipo;
  return 'violencia_' + tipo;
}
```

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/process-recording/index.ts` | Substituir `getAnalysisPrompt()` por versao dinamica |
| `supabase/functions/run-batch-analysis/index.ts` | Substituir `getDefaultAnalysisPrompt()` por versao dinamica |
| `supabase/functions/analysis-worker/index.ts` | Substituir `getMicroPrompt()` por versao dinamica |
| `supabase/functions/admin-audio-auto/index.ts` | Substituir funcao de prompt por versao dinamica |

### Sem alteracoes necessarias

- Tabela `tipos_alerta` -- ja esta completa
- Frontend/curadoria -- ja consome do banco via hook `useTiposAlerta`
- `admin_settings` override -- continua funcionando (prioridade sobre template dinamico)
