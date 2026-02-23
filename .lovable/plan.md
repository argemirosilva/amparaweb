
## Deixar as telas do Admin mais charmosas

### Problema atual
Todas as paginas admin (Curadoria, Auditoria, Usuarios, Orgaos, Configuracoes, Integracoes, Relatorios) seguem um visual muito basico: textos simples, tabelas sem destaque, headers planos sem hierarquia visual, sem uso de gradientes ou icones estilizados. O resultado e uma interface funcional mas sem personalidade.

### Abordagem
Aplicar um upgrade visual consistente em todas as paginas admin, mantendo a sobriedade institucional mas adicionando elementos que trazem mais charme e profissionalismo:

### Mudancas por componente

**1. Criar componente `AdminPageHeader`** (novo arquivo)
- Header reutilizavel para todas as paginas admin
- Icone com fundo gradiente (usando GradientIcon)
- Titulo em destaque + breadcrumb + descricao
- Borda inferior sutil com gradiente da marca Ampara

**2. Criar componente `AdminFilterBar`** (novo arquivo)
- Wrapper estilizado para filtros com fundo sutil, borda arredondada e leve sombra
- Substitui os wrappers ad-hoc de filtros em cada pagina

**3. Criar componente `AdminTableWrapper`** (novo arquivo)
- Card wrapper para tabelas com sombra sutil, header com fundo levemente tingido, bordas mais suaves
- Hover nas linhas com transicao suave

**4. Atualizar paginas individuais:**

- **AdminCuradoria**: Usar AdminPageHeader com icone BrainCircuit, AdminFilterBar, AdminTableWrapper. Adicionar badges coloridos sutis para risco e sentimento na tabela.
- **AdminAuditoria**: Usar AdminPageHeader com icone ClipboardCheck, melhorar a tabela e filtros.
- **AdminUsuarios**: Usar AdminPageHeader com icone Users, melhorar visual dos filtros de status (pills mais estilizados).
- **AdminOrgaos**: Usar AdminPageHeader com icone Building2, melhorar toolbar e tabela.
- **AdminConfiguracoes**: Usar AdminPageHeader com icone Settings, melhorar os cards de categoria com icones coloridos e bordas laterais.
- **AdminIntegracoes**: Usar AdminPageHeader com icone Plug, ja tem algum estilo mas uniformizar.
- **AdminRelatorios**: Usar AdminPageHeader com icone FileText, melhorar KPI cards e tabs.

### Detalhes visuais

- Headers: icone com fundo gradiente magenta-roxo (40x40px), titulo maior (text-2xl), descricao em muted
- Tabelas: sombra `shadow-sm`, header com `bg-muted/50`, hover nas linhas `hover:bg-muted/30`, transicao suave
- Filtros: card com `bg-card shadow-sm border`, padding uniforme
- Badges de risco: bolinhas coloridas com texto + dot indicator em vez de texto puro
- Paginacao: botoes com hover mais marcante

### Arquivos a criar
- `src/components/admin/AdminPageHeader.tsx`
- `src/components/admin/AdminFilterBar.tsx`  
- `src/components/admin/AdminTableWrapper.tsx`

### Arquivos a modificar
- `src/pages/admin/AdminCuradoria.tsx`
- `src/pages/admin/AdminAuditoria.tsx`
- `src/pages/admin/AdminUsuarios.tsx`
- `src/pages/admin/AdminOrgaos.tsx`
- `src/pages/admin/AdminConfiguracoes.tsx`
- `src/pages/admin/AdminIntegracoes.tsx`
- `src/pages/admin/AdminRelatorios.tsx`

### Resultado esperado
Interface admin com aspecto profissional e polido: headers com presenca visual, tabelas com sombras e hovers suaves, filtros organizados em cards, badges coloridos para status, tudo mantendo a coerencia da paleta institucional com toques da identidade Ampara (gradiente magenta-roxo nos icones de header).
