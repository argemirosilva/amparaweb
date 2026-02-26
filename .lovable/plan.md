
# Melhorias na Tela de Pesquisa do Parceiro

## Contexto

A tabela `agressores` possui vários campos ricos que o formulário de busca atual nao utiliza. O backend (searchAgressorAdvanced) ja envia esses dados para a IA ranquear, mas a usuaria nao pode filtrar por eles, perdendo oportunidades de refinar a busca.

## Campos disponíveis no banco mas ausentes no formulário

| Campo no banco | O que é | Por que é útil na busca |
|---|---|---|
| `forca_seguranca` | Se é policial/militar | Filtro critico -- mulheres sabem se o parceiro é PM/militar |
| `tem_arma_em_casa` | Se tem arma de fogo | Dado que a mulher sabe e ajuda cruzar |
| `cor_raca` | Cor/raca | Característica que a mulher conhece |
| `escolaridade` | Nível de escolaridade | Ajuda desambiguar homonimos |
| `sector` / `company_public` | Setor/empresa onde trabalha | Mais específico que "profissao" |
| `xingamentos_frequentes` | Xingamentos típicos que usa | Padrão comportamental unico -- muito discriminante |

## Plano de Implementação

### 1. Expandir o formulário (BuscaPerfilForm.tsx)

Adicionar novos campos na seção expansível ("Mais campos"):

- **"Ele é de alguma forca de seguranca?"** -- Select com opcoes: "Nao sei", "Sim", "Nao"
- **"Tem arma de fogo em casa?"** -- Select com opcoes: "Nao sei", "Sim", "Nao"
- **"Cor/Raca"** -- Select com opcoes do sistema (Branca, Preta, Parda, Indigena, Amarela, "Nao sei")
- **"Escolaridade"** -- Select com opcoes do sistema + "Nao sei"
- **"Empresa ou local de trabalho"** -- Input texto livre
- **"Xingamentos que ele costuma usar"** -- Input texto livre (separar por virgula)

Esses campos ficarao na secao expandivel para nao sobrecarregar a tela inicial.

### 2. Atualizar tipos e payload (BuscaPerfil.tsx)

Adicionar os novos campos ao `SearchFormData`:
- `forca_seguranca`: string ("sim" | "nao" | "")
- `tem_arma`: string ("sim" | "nao" | "")  
- `cor_raca`: string
- `escolaridade`: string
- `empresa`: string
- `xingamentos`: string

Atualizar `emptySearchForm` e o `handleSearch` para incluir esses campos no payload enviado ao backend.

### 3. Atualizar o backend (web-api/index.ts)

- Extrair os novos parametros do `params`
- Passar para `search_agressor_candidates` (se a funcao SQL aceitar) ou filtrar pos-SQL
- Incluir no `searchInput` enviado a IA para melhorar o ranqueamento

### 4. Atualizar a funcao SQL `search_agressor_candidates`

Criar migracao para adicionar parametros opcionais a funcao:
- `p_forca_seguranca` (boolean ou null)
- `p_tem_arma` (boolean ou null)
- `p_cor_raca` (text ou null)
- `p_escolaridade` (text ou null)
- `p_company` (text ou null)
- `p_xingamentos` (text ou null)

Quando informados, adicionar clausulas WHERE que filtram ou priorizam candidatos com esses atributos.

### 5. Enriquecer os resultados (BuscaPerfilResults.tsx)

Na secao expandida de cada resultado, adicionar:
- Badge "Forca de seguranca" (com icone de escudo) quando `forca_seguranca = true`
- Badge "Possui arma" (com icone de alerta) quando `tem_arma_em_casa = true`
- Exibir `xingamentos_frequentes` como tags quando disponivel -- padrão comportamental que a mulher pode reconhecer
- Exibir `flags` do agressor como badges de alerta

### Resumo visual

```text
Formulário atual         Formulário melhorado
+-----------------+      +-----------------+
| Nome            |      | Nome            |
| Idade           |      | Idade           |
| Pai / Mae       |      | Pai / Mae       |
| Cidade / Bairro |      | Cidade / Bairro |
|                 |      |                 |
| [+ Mais campos] |      | [+ Mais campos] |
|   DDD/Tel       |      |   DDD/Tel       |
|   Profissao     |      |   Profissao     |
|   Placa         |      |   Empresa       |
|                 |      |   Placa         |
|                 |      |   Cor/Raca      |
|                 |      |   Escolaridade  |
|                 |      |   Forca Seg?    |
|                 |      |   Tem arma?     |
|                 |      |   Xingamentos   |
+-----------------+      +-----------------+
```

Nos resultados:
```text
Resultado atual            Resultado melhorado
+--------------------+     +--------------------+
| J*** S***  [Alto]  |     | J*** S***  [Alto]  |
| 78% ========       |     | 78% ========       |
| Sinais fortes      |     | Sinais fortes      |
|                    |     | [Policial] [Armado] |
| [Ver detalhes]     |     | Xing: "vadia"...   |
+--------------------+     | [Ver detalhes]     |
                           +--------------------+
```

### Arquivos modificados

1. `src/pages/BuscaPerfil.tsx` -- novos campos no tipo e payload
2. `src/components/busca-perfil/BuscaPerfilForm.tsx` -- novos inputs
3. `src/components/busca-perfil/BuscaPerfilResults.tsx` -- badges e xingamentos
4. `supabase/functions/web-api/index.ts` -- extrair e passar novos params
5. Nova migracao SQL -- atualizar funcao `search_agressor_candidates`
