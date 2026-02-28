

# Nova Secao "Dados que Mudam a Historia" + Reforco de Anonimizacao

## Objetivo
Adicionar uma secao impactante na landing page que comunique o diferencial historico do AMPARA: pela primeira vez no mundo, uma base de dados real sobre cenarios e dinamicas de violencia domestica sera construida. Explicar o que isso significa para as vitimas e para o poder publico, reforçando com linguagem acessivel que todos os dados sao anonimizados e seguros.

## O que sera adicionado

### 1. Nova secao "Dados que Mudam a Historia" (entre Ecossistema e Funcionalidades)

Uma secao com visual de destaque contendo:

**Titulo:** "Pela primeira vez na historia, dados reais sobre violencia domestica"

**Subtitulo acessivel:** "Ate hoje, ninguem sabia de verdade o que acontece dentro de casa. O AMPARA muda isso — sem nunca expor quem voce e."

**Dois blocos lado a lado:**

| Bloco | Titulo | Conteudo |
|-------|--------|----------|
| Para voce | "O que isso muda na sua vida" | - Suas provas ficam guardadas com seguranca e podem te ajudar na justiça. - Quanto mais mulheres usam, mais o sistema aprende a proteger melhor. - Voce faz parte de algo maior: ajuda outras mulheres sem se expor. |
| Para o poder publico | "O que isso muda no Brasil" | - Governos vao saber onde e como a violencia acontece de verdade. - Politicas publicas deixam de ser baseadas em "achismo". - Delegacias e abrigos podem ser colocados onde mais se precisa. |

**Bloco de destaque sobre anonimizacao (abaixo dos dois cards):**

Um banner/callout com icone de cadeado enfatizando:
- "Ninguem — nem o governo, nem a policia, nem nos — consegue saber quem voce e pelos dados do painel."
- K-anonimato: so mostramos dados quando existem pelo menos 5 casos parecidos.
- Atraso de 48 horas: nada aparece em tempo real.
- Conformidade total com a LGPD.

### 2. Atualizar a secao de Seguranca existente

Adicionar um bullet point extra na lista de seguranca reforçando a anonimizacao dos dados publicos:
- "Dados publicos sao 100% anonimizados — impossivel identificar qualquer pessoa"

### 3. Adicionar link "Dados" na sub-nav

Incluir o novo item no array `SUB_NAV` para que a navegacao sticky aponte para a nova secao.

---

## Detalhes Tecnicos

### Arquivo modificado
- **`src/pages/LandingPage.tsx`** (unico arquivo)

### Alteracoes especificas

1. **Importar icone `Database`** do lucide-react (linha 4-10)
2. **Adicionar "Dados" ao array `SUB_NAV`** (entre "Ecossistema" e "Funcionalidades", linha ~81)
3. **Inserir nova secao `id="dados"`** entre a secao Ecossistema (linha ~409) e Funcionalidades (linha ~412), contendo:
   - Titulo e subtitulo impactantes
   - Grid 2 colunas com cards "Para voce" e "Para o poder publico"
   - Banner de anonimizacao com icone Lock e bullets explicativos
4. **Adicionar bullet extra na secao Seguranca** (linha ~503): "Dados publicos sao 100% anonimizados"

### Estilo visual
- Fundo com gradiente suave (consistente com demais secoes)
- Cards com `rounded-2xl`, bordas e sombras no hover
- Banner de anonimizacao com fundo escuro (primary) e texto branco para destaque
- Responsivo: 1 coluna no mobile, 2 colunas no desktop para os cards

