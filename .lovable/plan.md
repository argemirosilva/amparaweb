

## Adicionar nome e foto da usuaria no header da pagina de rastreamento

### O que muda

A pagina `/r/:codigo` (`Rastreamento.tsx`) ja busca `nome_completo` e `avatar_url` da tabela `usuarios`. Porem o header (barra superior) nao exibe essas informacoes — mostra apenas o tipo de alerta e o codigo.

### Alteracao

**Arquivo: `src/pages/Rastreamento.tsx`**

No bloco do top bar (div com `bg-zinc-900/80` ou `bg-red-900/80`), adicionar entre o icone Ampara e o timer:

- A foto da usuaria (ou iniciais como fallback) em um avatar circular de 36px com borda gradiente, usando o mesmo estilo visual do marcador do mapa.
- O primeiro nome da usuaria em texto branco, abaixo do label de status existente.

A estrutura do header ficara:

```text
[Logo Ampara] [Avatar + Nome] .................. [Timer]
               Alerta de Panico / Ao vivo         restante
               Codigo: X4K9NP
```

Nenhuma consulta adicional ao banco e necessaria — os dados `userInfo.nome_completo` e `userInfo.avatar_url` ja estao disponiveis no state.

### Detalhes tecnicos

1. Extrair `firstName` de `userInfo.nome_completo` (ja feito no bloco do marcador, reutilizar).
2. Renderizar um `img` com `rounded-full` e borda gradiente se `avatar_url` existir, ou um div com a inicial em fallback.
3. Colocar o nome ao lado do avatar, substituindo o layout atual do bloco esquerdo do header.
4. Manter responsividade — o avatar e nome devem truncar em telas pequenas sem quebrar o layout.

