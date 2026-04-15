

# Trocar "ouvir" por "exemplo" com modal de transcrições

## Problema
Os links `[GR:uuid]` no panorama macro mostram "ouvir" e navegam para a página de gravações. O pedido é: mostrar "exemplo" e, ao clicar, abrir um modal com a lista de transcrições usadas na análise.

## Dados disponíveis
O `aggregates_json` já contém `gravacoes_resumos` - um array com `{id, data, risco, resumo}` de cada gravação usada. Basta expor esse dado no componente.

## Mudanças em `src/components/gravacoes/MacroReportCard.tsx`

### 1. Atualizar interface e estado
- Expandir `aggregates_json` no tipo `MacroReport` para incluir `gravacoes_resumos?: { id: string; data: string; risco: string; resumo: string }[]`
- Adicionar estado `showExemplos` (boolean) para controlar o modal

### 2. Alterar `PanoramaWithCitations`
- Trocar o texto "ouvir" por "exemplo"
- Trocar o ícone `Play` por um ícone contextual (ex: `FileText`)
- Ao clicar, em vez de navegar, abrir o modal passando o ID clicado para scroll/destaque

### 3. Criar modal de transcrições
- Usar o componente `Dialog` existente
- Listar todas as `gravacoes_resumos` do `aggregates_json`
- Cada item mostra: data, nível de risco (badge colorido) e o resumo do texto
- Destacar o item correspondente ao link clicado (scroll automático)

## Arquivo alterado
- `src/components/gravacoes/MacroReportCard.tsx`

## Escopo
Uma edição pontual - sem mudanças no backend, os dados já existem no payload.

