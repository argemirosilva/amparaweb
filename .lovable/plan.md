

## Plan: Atalho de suporte com sub-categorias de problema na gravacao

### Situacao atual
Ja existe um componente `SupportShortcut` no `GravacaoExpandedContent.tsx` que redireciona para `/support/new` com query params pre-preenchidos (category, resource_type, resource_id, resource_label). A pagina `SupportNew` ja aceita esses params e pre-preenche o formulario.

### O que mudar

**1. Transformar o botao "Pedir suporte" em um menu com 3 opcoes**

No `SupportShortcut`, substituir o botao simples por um Popover ou DropdownMenu com as opcoes:
- "Problema com o audio" - navega com `category=playback`
- "Problema com a transcricao" - navega com `category=transcription_question`
- "Problema com download" - navega com `category=app_issue` e mensagem pre-preenchida sobre download

Cada opcao redireciona para `/support/new` com a categoria correta ja selecionada, o resource_id da gravacao e o label.

**2. Adicionar mensagem contextual pre-preenchida**

Alem da categoria, passar um param `pre_message` com texto contextual (ex: "Estou com dificuldade para baixar esta gravacao") para facilitar o preenchimento pela usuaria.

**3. Ajustar SupportNew para aceitar pre_message**

Ler o param `pre_message` dos search params e pre-preencher o campo de mensagem.

### Arquivos editados
- `src/components/gravacoes/GravacaoExpandedContent.tsx` - Transformar SupportShortcut em menu com 3 opcoes
- `src/pages/support/SupportNew.tsx` - Aceitar param `pre_message` para pre-preencher mensagem

