
# Nuvem de Palavras -- Painel Admin

## Objetivo
Criar uma nova pagina no painel administrativo que exiba uma **nuvem de palavras** (word cloud) baseada nas palavras-chave extraidas das analises de gravacoes (`gravacoes_analises.palavras_chave`).

## Dados Disponiveis
A tabela `gravacoes_analises` ja possui a coluna `palavras_chave` (tipo `text[]`) com dados reais. Exemplo das mais frequentes:

| Palavra | Ocorrencias |
|---------|-------------|
| socorro | 43 |
| medo | 41 |
| violencia | 41 |
| ameaca | 35 |
| perigo | 34 |
| agressor | 33 |
| ajuda | 32 |
| controle | 12 |

## Funcionalidades
- Visualizacao de nuvem de palavras com tamanho proporcional a frequencia
- Filtro por periodo (7 dias, 30 dias, 90 dias, todos)
- As palavras mais frequentes aparecem maiores e com cores mais fortes
- Layout responsivo seguindo o padrao visual do painel admin

## Implementacao Tecnica

### 1. Nova pagina `src/pages/admin/AdminNuvemPalavras.tsx`
- Componente que busca dados diretamente do Supabase (`gravacoes_analises`)
- Agrega as palavras-chave e calcula frequencias
- Renderiza a nuvem usando CSS puro (sem biblioteca externa) -- cada palavra e um `<span>` com `font-size` proporcional a frequencia e cores variadas do tema AMPARA
- Filtro de periodo usando selects no topo

### 2. Rota no `App.tsx`
- Adicionar rota `/admin/nuvem-palavras` dentro do bloco `<AdminLayout>`

### 3. Menu lateral no `AdminLayout.tsx`
- Adicionar item "Nuvem de Palavras" com icone `Cloud` do lucide-react no sidebar
- Visivel para todos os perfis admin (nao restrito a `admin_master`)

### 4. Estilo da Nuvem
- Implementacao CSS pura: palavras dispostas em `flex-wrap` centralizado
- Tamanho de fonte escalado entre 12px e 48px com base na frequencia
- Paleta de cores alternando entre tons da marca (azul AMPARA, roxo, cinza escuro)
- Hover mostra tooltip com a contagem exata
