

# Nova Secao Visual: Fluxo de Protecao

## Objetivo
Adicionar uma secao visual e intuitiva na landing page que explique passo a passo como o sistema de protecao funciona na pratica -- desde o monitoramento ate o acionamento de autoridades. Sera uma representacao tipo "pipeline" com icones conectados por setas/linhas.

## Onde sera inserida
Entre a secao "Funcionalidades" e "Como Funciona" (apos linha 544), com id `fluxo` e link na sub-nav.

## Conteudo do Fluxo (6 etapas conectadas visualmente)

| Etapa | Icone | Titulo | Descricao curta |
|-------|-------|--------|-----------------|
| 1 | Ear/Headphones | Monitoramento Ativo | O celular escuta o ambiente nos horarios que voce definir |
| 2 | Mic | Gravacao Manual | Voce tambem pode gravar manualmente a qualquer momento |
| 3 | Radio | Botao de Panico | Em situacoes de emergencia, acione com um toque |
| 4 | ArrowRight/Upload | Envio ao Servidor | Audios e dados sao enviados e analisados por inteligencia artificial |
| 5 | MessageCircle (WhatsApp) | Alerta aos Guardioes | Seus guardioes recebem notificacao via WhatsApp com sua localizacao |
| 6 | Phone | Chamada de Emergencia | O sistema liga automaticamente para 190 (Policia) e 180 (Delegacia da Mulher) |

## Design Visual
- Layout horizontal no desktop (6 colunas com setas/linhas conectoras entre cada etapa)
- Layout vertical no mobile (lista empilhada com linha vertical conectora)
- Cada etapa: icone dentro de circulo colorido + titulo em negrito + descricao curta abaixo
- Linha pontilhada ou solida conectando as etapas com gradiente de cor (do roxo ao vermelho)
- Fundo limpo (bg-background) para contrastar com secoes adjacentes

## Detalhes Tecnicos

### Arquivo modificado
- **`src/pages/LandingPage.tsx`** (unico arquivo)

### Alteracoes

1. **Importar icones adicionais**: `MessageCircle`, `Upload` do lucide-react (alguns ja importados)
2. **Adicionar "Fluxo" ao array `SUB_NAV`**: entre "Funcionalidades" e "Como Funciona"
3. **Criar array `FLOW_STEPS`** com os 6 passos (icone, titulo, descricao, cor)
4. **Inserir nova secao `id="fluxo"`** apos Funcionalidades (linha ~544), com:
   - Titulo: "Como o AMPARA te protege na pratica"
   - Grid responsivo com os 6 passos
   - Conectores visuais (borders/pseudo-elements via Tailwind) entre etapas
   - No desktop: layout horizontal com seta entre cada card
   - No mobile: layout vertical com linha lateral

### Estilo
- Cards com icone circular colorido (cada passo com cor distinta para guiar o olhar)
- Setas/conectores usando `ChevronRight` entre cards no desktop
- Linha vertical com bolinhas no mobile (timeline style)
- Responsivo: `grid-cols-2 md:grid-cols-3 lg:grid-cols-6`

