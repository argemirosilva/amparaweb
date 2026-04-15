

# Integrar a imagem hero de forma orgânica na página

## Problema
A imagem da mulher está dentro de um bloco retangular isolado, criando uma sensação de "caixa colada" no hero - não conversa com o fundo.

## Solução
Remover os containers rígidos e posicionar a imagem como elemento decorativo flutuante, sem bordas ou limites visíveis, integrada ao fundo da seção.

### Mudanças no Hero (`src/pages/LandingPage.tsx`)

1. **Desktop**: Trocar o `div` container da imagem por posicionamento absoluto. A imagem ficará no lado direito do hero, sem container visível, com fade suave nas bordas usando um CSS mask/gradient para dissolver os limites:
   - `position: absolute; right: 0; bottom: 0`
   - `mask-image: linear-gradient(to left, transparent 0%, black 15%, black 70%, transparent 100%)`
   - Opacidade reduzida (~85%) para parecer parte do fundo

2. **Mobile**: Manter a imagem com crop do topo, mas aplicar o mesmo mask-image vertical para suavizar o corte inferior.

3. **Remover o grid 2-col**: O hero passa a ser single-column com o texto à esquerda e a imagem como background decorativo no lado direito - sem divisão rígida de colunas.

## Arquivo alterado
- `src/pages/LandingPage.tsx` - Hero section (linhas ~233-278)

## Resultado
A imagem se dissolve organicamente no fundo branco, sem bordas ou containers demarcados - parte da composição visual, não um bloco separado.

