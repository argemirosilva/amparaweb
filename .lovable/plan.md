
## Mover o Relatorio MACRO para o Card de Evolucao de Risco

### O que muda

O relatorio MACRO (resumo dos ultimos N dias) sai de dentro de cada gravacao individual e passa a viver exclusivamente dentro do card "Evolucao do Risco", no botao "Como estou?". Alem disso, o seletor de janela (7d / 15d / 30d) que ja existe no card passa a controlar tambem qual relatorio MACRO e exibido.

### Mudancas

**1. Remover MacroReportCard de GravacaoExpandedContent**
- Arquivo: `src/components/gravacoes/GravacaoExpandedContent.tsx`
- Remover o import e a renderizacao do `MacroReportCard` (linhas 20, 329-333)
- O card de gravacao fica apenas com waveform, transcricao, acoes e AnaliseCard (MICRO)

**2. Integrar MacroReportCard dentro do RiskEvolutionCard**
- Arquivo: `src/components/dashboard/RiskEvolutionCard.tsx`
- Dentro da secao expandida ("Como estou?"), substituir o `RelatorioSaudeContent` (antigo relatorio de saude baseado em `getRelatorioSaude`) pelo `MacroReportCard` da nova pipeline
- O `MacroReportCard` recebera o `windowDays` do seletor de tabs ja existente (7, 15, 30), para que ao trocar a aba, tanto o grafico de risco quanto o relatorio MACRO atualizem juntos
- Remover a logica de cache e fetch do `RelatorioSaudeContent` (estados `relatorio`, `relatorioLoading`, `relatorioError`, `emotionalScore`, `cachedRelatorio`, `cachedForUser`, e a funcao `fetchRelatorio`)
- Remover o import de `RelatorioSaudeContent` e `computeEmotionalScore`

**3. Adaptar MacroReportCard para aceitar windowDays como prop**
- Arquivo: `src/components/gravacoes/MacroReportCard.tsx`
- Adicionar prop `windowDays: number` (default 7)
- Usar esse valor nas chamadas `getMacroLatest` e `runMacro` em vez do fixo `7`
- Refetch automaticamente quando `windowDays` mudar
- O botao "Gerar relatorio" mostra o periodo correto ("ultimos 7/15/30 dias")

### Resultado final

- Card "Evolucao do Risco" na Home: seletor 7d/15d/30d controla grafico + relatorio MACRO
- Botao "Como estou?" expande e mostra o MacroReportCard com dados da janela selecionada
- Card de gravacao individual: mostra apenas analise MICRO (AnaliseCard)

### Detalhes tecnicos

- `RiskEvolutionCard.tsx`: remover ~30 linhas de estado/cache do relatorio antigo; adicionar `<MacroReportCard sessionToken={sessionToken} windowDays={window} />` na secao expandida
- `MacroReportCard.tsx`: adicionar prop `windowDays`, usar em `fetchReport` e `generateReport`, adicionar `useEffect` para refetch quando `windowDays` mudar
- `GravacaoExpandedContent.tsx`: remover 2 linhas (import + renderizacao do MacroReportCard)
- Nenhuma mudanca no backend; os endpoints `getMacroLatest` e `runMacro` ja aceitam `window_days` como parametro
