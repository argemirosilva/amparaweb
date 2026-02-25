

# Teste: Dashboard da Usuaria com Identidade Azul-Roxo

Aplicar o mesmo padrao visual da landing page (gradiente azul-roxo profundo, textos claros, glassmorphism) ao layout e dashboard da usuaria como teste.

## Mudancas Visuais

### 1. AppLayout (container principal)
- Fundo do container principal: gradiente azul-roxo profundo (`bg-gradient-to-br from-[#1a1040] via-[#193275] to-[#1a1040]`)
- Area do `main` com texto claro por padrao

### 2. Topbar
- Fundo escuro com glassmorphism (`bg-white/5 backdrop-blur border-white/10`)
- Textos do nome/email em branco com opacidades (`text-white`, `text-white/60`)
- Avatar com borda sutil branca

### 3. BottomNav (mobile)
- Fundo escuro com glassmorphism (`bg-[#1a1040]/95 backdrop-blur border-white/10`)
- Icones e textos em `text-white/50` (inativo) e `text-white` (ativo)
- Botao central com fundo gradiente magenta-roxo

### 4. AppSidebar (desktop)
- Fundo escuro (`bg-[#1a1040]`)
- Itens do menu em `text-white/60`, hover e ativo em `text-white`
- Borda lateral em `border-white/10`

### 5. Cards do Dashboard (Home.tsx e sub-componentes)
- Cards com glassmorphism: `bg-white/5 backdrop-blur-sm border-white/10`
- Textos principais em `text-white`, secundarios em `text-white/60`
- Badges e indicadores mantendo cores funcionais (verde, amarelo, vermelho)

## Arquivos Modificados

| Arquivo | Descricao |
|---|---|
| `src/components/layout/AppLayout.tsx` | Gradiente de fundo no container |
| `src/components/layout/Topbar.tsx` | Glassmorphism, textos claros |
| `src/components/layout/BottomNav.tsx` | Fundo escuro, icones claros |
| `src/components/layout/AppSidebar.tsx` | Sidebar escura |
| `src/pages/Home.tsx` | Classes dos cards com glassmorphism |
| `src/components/dashboard/RiskEvolutionCard.tsx` | Card com fundo glass, textos claros |
| `src/components/dashboard/DeviceStatusCard.tsx` | Card com fundo glass, textos claros |
| `src/components/dashboard/AudioRecorderCard.tsx` | Card com fundo glass, textos claros |
| `src/components/dashboard/MonitoringStatusCard.tsx` | Card com fundo glass, textos claros |

## Abordagem Tecnica

- Substituir classes `bg-card`, `text-foreground`, `border-border` por classes diretas de cores escuras/claras nos componentes do layout
- Usar `ampara-card` override ou classes inline nos cards do dashboard para aplicar glassmorphism
- Manter as cores funcionais de risco (verde, amarelo, laranja, vermelho) inalteradas para nao prejudicar a usabilidade
- Como e um teste, as mudancas serao feitas diretamente nos componentes sem alterar o design system global (CSS variables), facilitando reverter se necessario

