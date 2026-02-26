

# Privacidade nos Resultados da Pesquisa

## Principio
Exibir nos resultados **apenas os dados sensiveis que a propria usuaria forneceu** na busca. Nunca revelar informacoes que ela nao conhecia antes.

## Mudancas

### 1. Remover xingamentos dos resultados (BuscaPerfilResults.tsx)
- Remover completamente o bloco de "Xingamentos" (linhas 90-98) do card de resultado
- Manter os xingamentos no payload de busca (servem para matching interno), mas nao exibi-los

### 2. Passar os dados do formulario para o componente de resultados
- `BuscaPerfil.tsx`: passar `formData` como prop para `BuscaPerfilResults`
- `BuscaPerfilResults`: receber `searchInput: SearchFormData` e repassar para cada `ResultCard`

### 3. Filtrar nome exibido com base no input da usuaria
- No `ResultCard`, em vez de exibir `display_name_masked` diretamente, cruzar com `searchInput.nome`
- Se a usuaria digitou "Carlos", exibir apenas as partes do nome que contenham "Carlos" (ex: "Carlos S***" em vez de "Carlos Roberto Silva")
- Se nenhum nome foi fornecido, exibir um placeholder generico como "Perfil #1"

### 4. Filtrar dados sensiveis no match breakdown
- No detalhamento expandido, so exibir `candidate_value_masked` se o campo correspondente foi preenchido pela usuaria
- Se a usuaria nao informou `nome_mae`, a linha do breakdown mostra apenas o status (bateu/nao bateu) sem revelar o valor do candidato
- Campos nao-sensiveis (risk_level, probabilidade, tipo de violencia) continuam sempre visiveis

### 5. Filtrar badges de perigo
- Badge "Forca de seguranca" so aparece se a usuaria marcou `forca_seguranca = "sim"` na busca
- Badge "Possui arma" so aparece se a usuaria marcou `tem_arma = "sim"` na busca
- Flags do sistema continuam visiveis (sao alertas genericos, nao dados pessoais)

### 6. Filtrar localizacao
- `location_summary` so aparece se a usuaria preencheu `cidade_uf` ou `bairro`

## Arquivos modificados

1. **`src/pages/BuscaPerfil.tsx`** -- passar `formData` como prop para `BuscaPerfilResults`
2. **`src/components/busca-perfil/BuscaPerfilResults.tsx`** -- receber `searchInput`, aplicar filtros de privacidade em nome, badges, breakdown e localizacao; remover xingamentos

## Logica de filtragem (resumo)

```text
Campo resultado     | Exibe se...
--------------------|------------------------------------------
Nome                | usuaria forneceu nome (mostra so partes que ela digitou)
Localizacao         | usuaria forneceu cidade_uf ou bairro
Forca de seguranca  | usuaria marcou "sim"
Possui arma         | usuaria marcou "sim"  
Xingamentos         | NUNCA (removido)
Breakdown valores   | campo correspondente foi preenchido
Risk level          | SEMPRE (nao e dado pessoal)
Probabilidade       | SEMPRE
Tipo violencia      | SEMPRE
Flags               | SEMPRE (alertas do sistema)
```
