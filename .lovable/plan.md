

## Trocar icone de Suporte para icone de chat

Substituir o icone `Headset` por `MessageCircle` (do lucide-react) em todos os pontos de navegacao de suporte do usuario. O `MessageCircle` remete visualmente a um chat/conversa.

### Arquivos afetados

1. **`src/components/layout/AppSidebar.tsx`** - Trocar import e uso de `Headset` por `MessageCircle` (menu lateral e footer)
2. **`src/components/layout/BottomNav.tsx`** - Nao tem suporte, nada a fazer
3. **`src/components/gravacoes/GravacaoExpandedContent.tsx`** - Trocar `Headset` por `MessageCircle` no botao "Pedir ajuda"
4. **`src/pages/support/SupportHome.tsx`** - Trocar `Headset` por `MessageCircle` no titulo da pagina

**Nota:** Os arquivos admin (`AdminLayout.tsx`) manterao o icone `Headset` pois sao para operadores de suporte, nao usuarios finais.

### Detalhes tecnicos

- Importar `MessageCircle` de `lucide-react` no lugar de `Headset`
- Manter todos os tamanhos e classes CSS iguais
- 4 arquivos, substituicao direta de icone

