

# Tornar o Ecossistema AMPARA Claro para Usuarias Leigas

## Problema Identificado
A landing page atual foca muito em termos tecnicosc como "inteligencia artificial", "monitoramento de dispositivos", "configuracoes avancadas" -- linguagem que nao conecta com o publico-alvo (mulheres com pouca instrucao). Falta uma secao que explique de forma visual e humana os **3 pilares** do ecossistema: Protecao, Monitoramento/Dados e Orientacao.

## Solucao Proposta

### 1. Nova secao "Ecossistema" -- visual e didatica (entre "Sobre" e "Funcionalidades")

Uma secao com 3 blocos grandes e visuais representando os pilares, usando linguagem simples e analogias do dia-a-dia:

| Pilar | Icone | Titulo Simples | Explicacao Acessivel |
|-------|-------|----------------|---------------------|
| Protecao | Shield/Heart | "Te protege" | "Como ter alguem de confianca sempre por perto. O sistema avisa suas pessoas de confianca quando voce precisa de ajuda." |
| Monitoramento e Dados | BarChart/Activity | "Te acompanha" | "Como um diario que guarda tudo pra voce. Grava audios, analisa riscos e cria relatorios que podem ser usados como prova." |
| Orientacao | BookOpen/Compass | "Te orienta" | "Como uma amiga que sabe onde buscar ajuda. Mostra seus direitos, numeros de emergencia e caminhos para sair da situacao." |

Cada bloco tera:
- Icone grande e colorido
- Titulo curto (2-3 palavras, linguagem cotidiana)
- Frase explicativa simples (sem jargao tecnico)
- Lista de 2-3 exemplos praticos em bullets

### 2. Reescrever textos-chave do Hero e Sobre

**Hero atual:**
> "Protecao, monitoramento e apoio para mulheres em situacao de vulnerabilidade. Uma plataforma gratuita com tecnologia de inteligencia artificial."

**Hero proposto:**
> "Voce nao esta sozinha. O AMPARA te protege, acompanha sua situacao e te orienta sobre seus direitos -- tudo pelo celular, de graca e em total sigilo."

**Secao Sobre -- subtitulo atual:**
> "Uma plataforma criada para proteger, monitorar e apoiar mulheres..."

**Proposto:**
> "O AMPARA e como ter uma rede de apoio no seu bolso. Ele cuida da sua seguranca, guarda provas quando voce precisar e te mostra o caminho para buscar ajuda."

### 3. Simplificar nomes das funcionalidades

| Atual | Proposto |
|-------|----------|
| "Evolucao do Risco" | "Seu Nivel de Seguranca" |
| "Monitoramento de Dispositivos" | "Saber se seu celular esta protegido" |
| "Gravacao de Audio" | "Grava o que acontece ao redor" |
| "Envio de Arquivos" | "Guarda provas com seguranca" |
| "Localizacao via GPS" | "Compartilha onde voce esta" |
| "Pesquisa de Parceiros" | "Consulta sobre agressores" |
| "Suporte Dedicado" | "Alguem pra te ouvir" |
| "Configuracoes Avancadas" | "Voce controla tudo" |

As descricoes tambem serao reescritas em linguagem simples.

### 4. Adicionar a secao "Ecossistema" na sub-nav

Adicionar o link "Ecossistema" no array `SUB_NAV` para que a navegacao sticky tambem aponte para essa nova secao.

---

## Detalhes Tecnicos

### Arquivos modificados
- **`src/pages/LandingPage.tsx`**: Unico arquivo a ser editado

### Alteracoes especificas
1. Adicionar nova secao `id="ecossistema"` entre as secoes "Sobre" e "Funcionalidades" (apos linha ~318, antes da linha ~321)
2. Atualizar o texto do Hero (linhas 218-219)
3. Atualizar subtitulo da secao Sobre (linhas 289-290)
4. Reescrever o array `FEATURES` (linhas 34-42) com titulos e descricoes simplificados
5. Adicionar "Ecossistema" ao array `SUB_NAV` (linha ~78)
6. Importar icones adicionais: `Shield, BookOpen, Activity` do lucide-react

### Estilo visual da nova secao
- Fundo com gradiente suave (consistente com as demais secoes)
- Cards grandes com `rounded-2xl`, icones de 48px, tipografia clara
- Responsivo: 1 coluna no mobile, 3 colunas no desktop

