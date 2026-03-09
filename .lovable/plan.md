

## Card com design lateral (estilo KPI)

O usuário quer adotar o estilo do card da imagem de referência: card arredondado com um **círculo decorativo grande e semi-transparente no canto direito** contendo um ícone, título em texto leve e valor em destaque. Estilo clean, minimalista.

### O que fazer

1. **Criar uma nova classe CSS `.ampara-card-kpi`** em `src/index.css` (dentro de `@layer components`):
   - Card branco arredondado (`rounded-2xl`) com sombra suave
   - Pseudo-elemento `::after` posicionado no canto superior direito como um círculo grande (~80px) semi-transparente (usando a cor primary com ~8% opacidade)
   - Overflow hidden para o círculo não vazar

2. **Criar componente `AmparaKpiCard`** em `src/components/ui/ampara-kpi-card.tsx`:
   - Props: `title`, `value`, `subtitle?`, `icon` (LucideIcon), `trend?`
   - Usa a classe `.ampara-card-kpi`
   - Ícone dentro de um círculo translúcido posicionado no canto direito (como na referência)
   - Título em texto pequeno/muted, valor grande e bold

3. **Aplicar nos cards do dashboard** (`Home.tsx` e onde fizer sentido) substituindo cards existentes ou adicionando como novo componente reutilizável.

### CSS (resumo)

```css
.ampara-card-kpi {
  @apply bg-card rounded-2xl p-5 border border-border/40 relative overflow-hidden;
  box-shadow: 0 2px 8px -2px hsl(220 20% 20% / 0.06);
}
.ampara-card-kpi .kpi-circle {
  @apply absolute -top-2 -right-2 w-20 h-20 rounded-full;
  background: hsl(var(--ampara-purple) / 0.08);
}
```

### Componente (resumo)

```tsx
<div className="ampara-card-kpi">
  <div className="kpi-circle flex items-center justify-center">
    <Icon className="w-6 h-6 text-primary/50" />
  </div>
  <p className="text-sm text-muted-foreground">{title}</p>
  <p className="text-3xl font-bold mt-1">{value}</p>
</div>
```

