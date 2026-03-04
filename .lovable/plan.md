

## Plano: Tela de Configuração de Palavras de Triagem

### Problema
As palavras-chave de risco para a triagem de segmentos estão hardcoded no código (`offenseWords.ts`). Precisam ser gerenciáveis pelo admin sem deploy.

### Proposta

**Onde colocar:** Seção colapsável em `AdminConfiguracoes`, seguindo o mesmo padrão do "Tipos de Alerta" que já existe ali. Consistente com o design atual.

### 1. Nova tabela `palavras_triagem`

```sql
CREATE TABLE public.palavras_triagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palavra text NOT NULL,
  grupo text NOT NULL DEFAULT 'ameaca',  -- ameaca, xingamento, socorro, arma
  peso integer NOT NULL DEFAULT 1,       -- 1=normal, 2=alto, 3=critico
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_palavras_triagem_palavra ON palavras_triagem(palavra);
```

**Grupos:**
- `ameaca` — "matar", "te mato", "vou te bater"
- `xingamento` — importar do `offenseWords.ts` atual
- `socorro` — "socorro", "me ajuda", "para"
- `arma` — "arma", "faca", "revolver", "sangue"

**Peso:** determina se keyword sozinha já escala para Camada 2 (IA) ou precisa de múltiplas ocorrências.

### 2. Backend: 2 actions no `admin-api`

- **`listPalavrasTriagem`** — retorna todas, ordenadas por grupo + palavra
- **`upsertPalavraTriagem`** — criar/editar/toggle ativo
- **`deletePalavraTriagem`** — remover

### 3. Frontend: Componente `AdminPalavrasTriagem`

Novo componente em `src/pages/admin/AdminPalavrasTriagem.tsx`, renderizado como seção colapsável em `AdminConfiguracoes` (abaixo de "Tipos de Alerta").

**UI:**
- Filtro por grupo (chips: Ameaça, Xingamento, Socorro, Arma)
- Lista de palavras com toggle ativo/inativo, badge de peso, botão deletar
- Form inline para adicionar nova palavra (input + select grupo + select peso)
- Botão "Importar padrão" para seed inicial das ~120 palavras

### 4. Integração com Segment Triage

A edge function `segment-triage` consulta `palavras_triagem` (ativo=true) em vez de usar lista hardcoded. Cache de 5 minutos para não consultar DB a cada segmento.

### Arquivos

| Arquivo | Mudança |
|---|---|
| Migração SQL | Cria `palavras_triagem` + seed inicial |
| `supabase/functions/admin-api/index.ts` | 3 actions CRUD |
| `src/pages/admin/AdminPalavrasTriagem.tsx` | Novo componente |
| `src/pages/admin/AdminConfiguracoes.tsx` | Adiciona seção colapsável |
| `segment-triage` (futuro) | Consome da tabela em vez de hardcoded |

