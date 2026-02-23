

## Tela de Curadoria de Transcrições para Treinamento de IA

### Objetivo

Criar uma nova tela administrativa (`/admin/curadoria`) que exiba transcrições e resultados de análise de forma **anonimizada**, servindo como base de dados curada para futuro treinamento do modelo de IA. Dados sensíveis (nomes, telefones, documentos, enderecos) serao substituidos por `*********` antes de chegar ao front-end.

---

### Arquitetura

A anonimizacao sera feita **no backend** (edge function) para garantir que dados sensíveis nunca cheguem ao navegador do curador.

```text
+-----------------+       +------------------+       +------------------+
|  AdminCuradoria |  -->  |  admin-api       |  -->  |  gravacoes +     |
|  (React page)   |       |  action:          |       |  gravacoes_      |
|                 |       |  listCuradoria   |       |  analises +      |
|                 |       |  (anonimiza no   |       |  analysis_micro  |
|                 |       |   servidor)      |       |  _results        |
+-----------------+       +------------------+       +------------------+
```

---

### Etapas

**1. Backend -- novo action `listCuradoria` na admin-api**

Adicionar ao `supabase/functions/admin-api/index.ts` um novo action que:

- Autentica o admin (reusa `authenticateAdmin`)
- Consulta `gravacoes` com status `processado` + join com `gravacoes_analises` (via `gravacao_id`)
- Opcionalmente filtra por `nivel_risco`, intervalo de datas e flag `cupiado`
- Aplica funcao de anonimizacao regex sobre a `transcricao` e o `resumo` antes de retornar:
  - CPF (`\d{3}\.?\d{3}\.?\d{3}-?\d{2}`) -> `*********`
  - Telefone (`\(?\d{2}\)?\s?\d{4,5}-?\d{4}`) -> `*********`
  - E-mail (`\S+@\S+\.\S+`) -> `*********`
  - Nomes proprios: substituir tokens capitalizados com 2+ caracteres que aparecem em sequencia (ex: "Maria Silva") -> `*********`
  - CEP (`\d{5}-?\d{3}`) -> `*********`
  - Enderecos: padroes como "Rua ..., n" / "Av. ..." -> `*********`
- Paginacao (offset/limit)
- Retorna array de objetos com: `id`, `created_at`, `duracao_segundos`, `transcricao_anonimizada`, `nivel_risco`, `sentimento`, `categorias`, `palavras_chave`, `xingamentos`, `resumo_anonimizado`, `context_classification`, `cycle_phase`, `output_json_anonimizado` (do micro result, se existir)

**2. Backend -- novo action `exportCuradoria`**

- Retorna os mesmos dados em formato JSON estruturado (array completo, sem paginacao) para download como `.jsonl` (um JSON por linha), ideal para fine-tuning de modelos

**3. Backend -- novo action `toggleCuradoria`**

- Marca/desmarca uma gravacao como "curada" (novo campo `cupiado boolean default false` na tabela `gravacoes_analises`)
- Permite ao curador selecionar quais amostras sao boas para treinamento

**4. Migracao SQL**

- Adicionar coluna `cupiado` (`boolean default false`) em `gravacoes_analises`
- Criar indice para facilitar filtro

```sql
ALTER TABLE gravacoes_analises ADD COLUMN IF NOT EXISTS cupiado boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_gravacoes_analises_cupiado ON gravacoes_analises(cupiado);
```

**5. Front-end -- nova pagina `src/pages/admin/AdminCuradoria.tsx`**

Componentes e funcionalidades:

- **Filtros superiores**: nivel de risco (dropdown), intervalo de datas, checkbox "somente curadas"
- **Tabela principal** com colunas:
  - Data/hora
  - Duracao
  - Nivel de risco (badge colorido)
  - Sentimento
  - Preview da transcricao (primeiros 80 chars anonimizados)
  - Botao cupiado (checkbox)
- **Drawer/modal de detalhes** ao clicar em uma linha:
  - Transcricao completa anonimizada (texto formatado)
  - Resumo anonimizado
  - Categorias, palavras-chave, xingamentos (badges)
  - Classificacao de contexto e fase do ciclo
  - Output JSON completo do micro result (colapsavel, para inspecao tecnica)
  - Botao "Marcar como curada" / "Desmarcar"
- **Botao de exportacao** (download `.jsonl` das amostras filtradas/curadas)
- Paginacao com 25/50/100 por pagina (mesmo padrao de AdminUsuarios)

**6. Rota e sidebar**

- Adicionar rota `/admin/curadoria` em `App.tsx`
- Adicionar item "Curadoria IA" no sidebar do `AdminLayout.tsx` com icone `BrainCircuit` (lucide)
- Visivel apenas para `super_administrador` e `administrador` (adicionar path ao filtro existente)

---

### Detalhes Tecnicos

**Funcao de anonimizacao (backend)**

```text
function anonymize(text: string): string
  1. Regex para CPF, telefone, email, CEP -> "*********"
  2. Regex para enderecos (Rua/Av/Travessa + texto ate virgula/numero) -> "*********"  
  3. Regex para sequencias de palavras capitalizadas (2+ tokens) -> "*********"
  4. Retorna texto limpo
```

**Seguranca**
- Acesso restrito a `super_administrador` e `administrador` via `authenticateAdmin`
- Dados nunca saem do servidor sem anonimizacao
- O audio original NAO sera exposto nesta tela (somente texto)

**Estilo visual**
- Seguira o mesmo padrao visual das demais telas admin (fundo cinza claro, cards brancos, fonte Inter)
- Badges de risco reutilizarao as cores ja definidas no sistema

