

# Adicionar filtros de busca por Cidade e Bairro no AdminMapa

## Problema
Atualmente o mapa admin permite navegar apenas por UF (clicando nos estados). Não há campo de busca para localizar diretamente uma cidade ou bairro.

## Solução
Adicionar dois campos de busca/seleção na sidebar do mapa: um para Cidade e outro para Bairro. Ao selecionar uma cidade, o mapa centraliza nela e filtra os dados. Ao selecionar um bairro dentro da cidade, refina ainda mais.

## Alterações em `src/pages/admin/AdminMapa.tsx`

### 1. Novos estados
- `filterCidade` e `filterBairro` (strings, inicialmente vazias)
- Listas derivadas: `availableCidades` (extraídas dos dados de `devices` e `alerts` agrupados por UF selecionada) e `availableBairros` (filtrados pela cidade selecionada)

### 2. Campos de busca na sidebar
- Acima do ranking por município (quando uma UF está selecionada), adicionar:
  - **Combobox Cidade**: input de texto com autocomplete, filtrando a lista de cidades disponíveis naquela UF. Ao selecionar, seta `filterCidade`, limpa `filterBairro`.
  - **Combobox Bairro**: aparece quando uma cidade está selecionada. Input com autocomplete filtrando bairros daquela cidade.
- Usar inputs simples com datalist (sem dependências extras) para manter o padrão leve do componente.

### 3. Filtragem visual
- Quando `filterCidade` está setada: filtrar `bairroClusters` e `alertClusters` para mostrar apenas os da cidade selecionada. O mapa faz flyTo para a região da cidade.
- Quando `filterBairro` está setado: filtrar ainda mais para o bairro específico. Zoom maior.
- O ranking por município também filtra para destacar a cidade/bairro selecionado.

### 4. Navegação
- Limpar filtros ao mudar de UF ou voltar para Brasil.
- Botão "Limpar filtro" ao lado dos campos quando há filtro ativo.

### 5. DashboardMapCard
- Mesma lógica aplicada no `src/components/institucional/DashboardMapCard.tsx` - campos de busca cidade/bairro na sidebar.

## Arquivos alterados
- `src/pages/admin/AdminMapa.tsx`
- `src/components/institucional/DashboardMapCard.tsx`

