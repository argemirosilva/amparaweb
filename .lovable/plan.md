

# Trocar imagem do painel esquerdo do Login

## O que muda
Substituir o logo quadrado (`ampara-logo-login.png`) no painel esquerdo da tela de login pela ilustração line-art da mulher olhando para cima.

## Alterações

### 1. Copiar imagem para o projeto
- Copiar `user-uploads://image-54.png` para `src/assets/login-illustration.png`

### 2. Atualizar `src/pages/Login.tsx`
- Trocar o import de `ampara-logo-login.png` pela nova ilustração
- Reposicionar a ilustração no painel esquerdo: em vez de centralizada com `w-48`, usar a imagem maior posicionada à direita do painel (como na referência), ocupando boa parte da altura
- Mover o logo AMPARA e os textos para o lado esquerdo/inferior do painel, criando o layout split com a mulher à direita
- A imagem terá `object-contain` com posicionamento `bottom-right` para manter o efeito da referência

### Arquivos alterados
- `src/assets/login-illustration.png` (novo)
- `src/pages/Login.tsx`

