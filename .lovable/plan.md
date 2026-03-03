

## Plano: Ícones GradientIcon em tons de azul nas páginas admin

### Problema
O componente `GradientIcon` usa `var(--ampara-gradient)` (lilás→magenta) em todas as páginas, incluindo admin. O usuário quer tons de azul sóbrio apenas no admin.

### Abordagem
Adicionar uma prop `variant` ao `GradientIcon` com dois modos:
- `"default"` — gradiente atual (lilás/magenta) para páginas de usuário
- `"admin"` — gradiente em tons de azul-cinza escuro para páginas admin

### Alterações

**1. `src/components/ui/gradient-icon.tsx`**
- Adicionar prop `variant?: "default" | "admin"`
- `"admin"` aplica gradiente azul escuro: `linear-gradient(135deg, hsl(215, 25%, 35%), hsl(210, 30%, 25%))`
- Default mantém `var(--ampara-gradient)`

**2. `src/components/admin/AdminPageHeader.tsx`**
- Passar `variant="admin"` ao `GradientIcon` — afeta headers de todas as páginas admin automaticamente

Todas as páginas admin (Usuários, Entidades, Auditoria, Relatórios, Configurações, Tipos de Alerta, Curadoria, Integrações, COPOM, Gerador de Áudios, Mapa) usam `AdminPageHeader`, então a mudança se propaga automaticamente.

