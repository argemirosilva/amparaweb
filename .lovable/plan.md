

## Landing Page AMPARA Mulher

### Resumo
Criar uma landing page completa na rota `/` (substituindo o redirect para `/login`), com todas as secoes solicitadas, usando os tokens de design AMPARA existentes e componentes Lucide para icones.

### Arquivos a criar

**1. `src/pages/LandingPage.tsx`** - Pagina principal da landing page
- Componente unico com todas as secoes inline (header, hero, sobre, funcionalidades, como funciona, depoimentos, FAQ, cadastro, parceiros, contato, footer)
- Header fixo com logo AMPARA, menu de navegacao por ancora (#sobre, #funcionalidades, etc.) e botao "Cadastre-se" destacado
- Menu mobile com hamburger usando Sheet component
- Scroll suave entre secoes via `scrollIntoView`

### Secoes detalhadas

**Header fixo:**
- Logo `ampara-logo.png`, links de navegacao por ancora, botao CTA magenta
- `sticky top-0 z-50 bg-white/95 backdrop-blur`
- Menu hamburger no mobile

**Hero Section:**
- Fundo com gradiente suave roxo/magenta
- Titulo "AMPARA Mulher -- Protecao, monitoramento e apoio para voce"
- Subtitulo com texto de missao
- Botao CTA grande "Cadastre-se agora" com icone Shield
- Ilustracao com icones representativos (Heart, Shield, Users) em circulos gradiente

**Sobre:**
- Missao, visao e proposito em 3 cards com icones
- Numeros de impacto social (cards com contadores estaticos): "+2.500 mulheres protegidas", "+15.000 analises realizadas", "+98% satisfacao"

**Funcionalidades:**
- Grid 2x4 de cards (`ampara-feature-card`) com icones Lucide:
  - TrendingUp (Evolucao do Risco), Smartphone (Monitoramento), Mic (Gravacao), FileUp (Envio de Arquivos), MapPin (GPS), Search (Pesquisa Parceiros), Headphones (Suporte), Settings (Configuracoes)

**Como Funciona:**
- 4 passos numerados com `ampara-badge-number`: Cadastre-se, Ative o monitoramento, Use as ferramentas, Conte com suporte
- Layout horizontal no desktop, vertical no mobile

**Depoimentos:**
- 3 cards com avatar (iniciais), nome ficticio, relato e estrelas
- Classe `ampara-quote` para estilizacao

**FAQ:**
- Accordion expansivel usando componente `Accordion` existente
- 8 perguntas sobre funcionamento, seguranca, privacidade, cadastro

**Cadastro / Faca Parte:**
- Secao com fundo gradiente escuro (`ampara-panel-bg`)
- Lado esquerdo: beneficios em lista com icones Check
- Lado direito: formulario simples (nome, email, telefone, senha) usando `ampara-input`
- Submissao via `useAuth().register()` existente, redirecionando para `/validar-email`
- Validacao: nome obrigatorio, email valido, telefone 10+ digitos, senha 6+ chars, termos aceitos

**Parceiros e Impacto:**
- Logos placeholder (icones Building2, Heart, Users2) representando ONGs e parceiros
- Metricas de impacto em cards numericos
- CTA para novos parceiros

**Contato e Suporte:**
- Email de contato, informacoes de emergencia (Ligue 180, 190)
- Formulario simples de contato (nome, email, mensagem) -- submit via toast de confirmacao
- Badge de emergencia sempre visivel

**Footer:**
- Links rapidos para todas as secoes
- Link para `/privacidade`
- Copyright com ano dinamico
- Texto institucional AMPARA

### Alteracao no roteamento

**2. `src/App.tsx`**
- Alterar rota `/` de `<Navigate to="/login" replace />` para `<LandingPage />`
- Importar o novo componente

### Design e Acessibilidade
- Cores: tokens AMPARA existentes (magenta, roxo, ciano, deep-blue)
- Fontes: Poppins para titulos, DM Sans para corpo (ja configuradas)
- Classes reutilizadas: `ampara-btn-primary`, `ampara-btn-secondary`, `ampara-input`, `ampara-card`, `ampara-feature-card`, `ampara-quote`, `ampara-icon-circle`, `ampara-badge-number`, `ampara-section-title`, `ampara-section-subtitle`
- Botoes grandes, contraste adequado, textos alt em icones
- Responsivo: grid adaptavel, menu hamburger mobile
- Animacoes: `animate-fade-in` existente para entrada das secoes

### Detalhes tecnicos
- Sem dependencias novas -- usa Lucide, Accordion, Sheet ja instalados
- Formulario de cadastro reutiliza `useAuth().register()` e `formatPhone` do Cadastro.tsx
- Nenhuma alteracao no banco de dados necessaria
- Pagina publica, sem autenticacao requerida

