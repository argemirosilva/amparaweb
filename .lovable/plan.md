

## Avaliacao Isolada por Campo na Curadoria

### Objetivo

Transformar o drawer de detalhes da curadoria em uma interface de avaliacao granular, onde cada aspecto da analise da IA (risco, sentimento, taticas, ciclo, etc.) pode ser avaliado individualmente com aprovacao/rejeicao, correcao de valor e notas do curador.

---

### 1. Nova tabela: `curadoria_avaliacoes`

Armazena a avaliacao do curador para cada campo de cada analise.

```sql
CREATE TABLE curadoria_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id uuid NOT NULL REFERENCES gravacoes_analises(id) ON DELETE CASCADE,
  campo text NOT NULL,           -- ex: 'nivel_risco', 'sentimento', 'taticas_manipulativas', etc.
  status text NOT NULL DEFAULT 'pendente',  -- 'correto', 'incorreto', 'pendente'
  valor_corrigido jsonb,         -- valor correto sugerido pelo curador (null = sem correcao)
  nota text,                     -- observacao livre do curador
  avaliado_por uuid REFERENCES usuarios(id),
  avaliado_em timestamptz DEFAULT now(),
  UNIQUE(analise_id, campo)
);

CREATE INDEX idx_curadoria_avaliacoes_analise ON curadoria_avaliacoes(analise_id);
```

### 2. Backend -- novos actions na admin-api

- **`getAvaliacoes`**: Retorna todas as avaliacoes de uma analise (por `analise_id`)
- **`saveAvaliacao`**: Upsert de uma avaliacao para um campo especifico (analise_id, campo, status, valor_corrigido, nota)

### 3. Front-end -- Drawer com abas por aspecto

O drawer de detalhes sera reorganizado em **abas** (usando o componente `Tabs` existente):

| Aba | Conteudo | Campos avaliaveis |
|-----|----------|-------------------|
| **Geral** | Transcricao e resumo anonimizados, data, duracao | - |
| **Risco** | Nivel de risco, justificativa, sinais de alerta | `nivel_risco`, `sinais_alerta` |
| **Sentimento** | Sentimento detectado, categorias, palavras-chave | `sentimento`, `categorias` |
| **Taticas** | Taticas manipulativas com evidencias e gravidade | `taticas_manipulativas` |
| **Ciclo** | Fase do ciclo, classificacao de contexto, tipos de violencia | `cycle_phase`, `context_classification`, `tipos_violencia` |
| **JSON** | Output JSON completo (colapsavel, somente leitura) | - |

### 4. Componente de avaliacao por campo

Cada campo avaliavel tera um bloco visual padrao:

```text
+----------------------------------------------+
| [Campo: Nivel de Risco]                      |
| Valor da IA: [critico]                       |
|                                              |
| Avaliacao: (o) Correto  (o) Incorreto       |
|                                              |
| Valor corrigido: [dropdown com opcoes]       |
| (visivel apenas se "Incorreto")              |
|                                              |
| Nota: [textarea livre]                       |
|                                              |
| [Salvar avaliacao]                           |
+----------------------------------------------+
```

- Radio group para Correto/Incorreto
- Campo de correcao contextual (dropdown para campos com opcoes fixas como risco/sentimento, textarea para campos livres)
- Textarea para nota do curador
- Botao salvar por campo (ou auto-save)

### 5. Campos avaliaveis e tipos de correcao

| Campo | Tipo de correcao |
|-------|-----------------|
| `nivel_risco` | Select: critico, alto, moderado, baixo, nenhum |
| `sentimento` | Select: positivo, negativo, neutro, misto |
| `categorias` | Input de tags (texto livre separado por virgula) |
| `sinais_alerta` | Textarea (lista de sinais) |
| `taticas_manipulativas` | Textarea JSON (lista de taticas corrigidas) |
| `cycle_phase` | Select: tensao, explosao, lua_de_mel, calmaria, nao_identificado |
| `context_classification` | Select: saudavel, rispido_nao_abusivo, potencial_abuso_leve, padrao_consistente_abuso, ameaca_risco, risco_elevado_escalada |
| `tipos_violencia` | Input de tags |

### 6. Exportacao enriquecida

O export `.jsonl` incluira as avaliacoes do curador junto aos dados anonimizados, criando um dataset com ground truth para fine-tuning:

```json
{
  "transcricao": "...",
  "output_ia": { ... },
  "avaliacoes": {
    "nivel_risco": { "status": "incorreto", "valor_corrigido": "moderado", "nota": "..." },
    "sentimento": { "status": "correto" }
  }
}
```

### 7. Indicador visual na tabela principal

Adicionar uma coluna "Avaliada" na tabela, mostrando o progresso de avaliacao (ex: "4/6 campos") para cada transcricao, permitindo identificar rapidamente quais ainda precisam de revisao.

---

### Arquivos a modificar

- **Migracao SQL**: Criar tabela `curadoria_avaliacoes`
- **`supabase/functions/admin-api/index.ts`**: Adicionar actions `getAvaliacoes`, `saveAvaliacao`; enriquecer `exportCuradoria` com avaliacoes
- **`src/pages/admin/AdminCuradoria.tsx`**: Reorganizar drawer com Tabs, adicionar componente de avaliacao por campo, coluna de progresso na tabela

