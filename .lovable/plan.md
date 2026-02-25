

## Aplicar visual azul/roxo consistente em toda a Landing Page

### Objetivo
Aplicar o mesmo padrao visual do hero (gradiente azul-roxo profundo com acentos ciano e texto branco) em todas as secoes da landing page, criando uma experiencia visual coesa e profissional.

### O que muda

Todas as secoes da pagina serao atualizadas para seguir o mesmo esquema de cores do hero:
- **Fundo**: gradientes azul-roxo profundo em vez de branco/cinza claro
- **Texto**: branco com opacidades variadas em vez de foreground/muted-foreground
- **Acentos**: ciano `hsl(175, 80%, 55%)` para destaques
- **Cards/elementos**: fundo semi-transparente branco (glassmorphism) em vez de cards brancos solidos
- **Icones**: circulos com borda/fundo semi-transparente branco em vez do gradiente magenta

### Secoes afetadas

| Secao | Mudanca |
|---|---|
| **Header** | Fundo azul-roxo escuro, logo invertido, links e botoes em branco |
| **Sobre** | Fundo gradiente azul, cards com glassmorphism, numeros de impacto em ciano |
| **Funcionalidades** | Fundo gradiente levemente diferente, feature cards em vidro, icones em branco/ciano |
| **Como Funciona** | Fundo azul escuro, badges numerados em ciano, setas em branco |
| **Depoimentos** | Fundo com tom roxo mais intenso, quotes em vidro semi-transparente |
| **FAQ** | Fundo azul medio, accordion em branco semi-transparente |
| **Faca Parte** | Ja esta escuro -- ajustar para manter consistencia com ciano |
| **Parceiros** | Fundo gradiente azul, cards em vidro |
| **Contato** | Fundo azul-roxo, inputs com estilo glassmorphism |
| **Footer** | Ja esta escuro -- manter e ajustar detalhes |

### Detalhes tecnicos

**Arquivo unico: `src/pages/LandingPage.tsx`**

1. **Header (linhas 104-136)**: Trocar `bg-background/95` por fundo azul escuro com backdrop-blur. Textos de nav em branco. Botoes com bordas brancas.

2. **Sobre (linhas 192-220)**: Trocar `bg-background` por gradiente azul. Cards `.ampara-card` recebem classes inline de glassmorphism (`bg-white/10 border-white/15 backdrop-blur`). Textos em branco. Numeros de impacto em ciano.

3. **Funcionalidades (linhas 223-237)**: Trocar `ampara-gradient-soft` por gradiente azul mais claro. Feature cards com glassmorphism. Icones em branco sobre fundo semi-transparente.

4. **Como Funciona (linhas 240-262)**: Fundo azul escuro. Badges em ciano. Texto em branco.

5. **Depoimentos (linhas 265-290)**: Fundo roxo-azul. Quote cards em vidro. Estrelas em ciano/dourado.

6. **FAQ (linhas 293-306)**: Fundo azul medio. Accordion items em branco semi-transparente.

7. **Parceiros (linhas 351-375)**: Fundo gradiente azul. Cards em vidro.

8. **Contato (linhas 378-417)**: Fundo azul-roxo. Inputs com glassmorphism. Botao enviar mantido.

9. **Container raiz (linha 102)**: Trocar `bg-background` por cor base escura para evitar flashes brancos.

### Paleta consistente utilizada

- Fundo principal: `hsl(255, 55%, 28%)` a `hsl(210, 80%, 45%)`
- Fundo alternado (secoes pares): leve variacao de opacidade/angulo
- Texto principal: `text-white`
- Texto secundario: `text-white/70` ou `text-white/60`
- Destaque: `hsl(175, 80%, 55%)` (ciano)
- Cards: `bg-white/10 border-white/15 backdrop-blur-sm`
- Inputs: `bg-white/15 border-white/20 text-white`

