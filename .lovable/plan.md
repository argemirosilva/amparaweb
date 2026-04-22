

# Organograma macro do Sistema Ampara

Vou criar um diagrama visual (PDF) explicando a arquitetura macro do sistema Ampara, mostrando os módulos, suas funções e como eles interagem entre si. Ideal para inclusão em proposta comercial/institucional.

## O que será entregue

Um arquivo **PDF de 2 páginas** em `/mnt/documents/Ampara_Organograma_Sistema.pdf`:

**Página 1 - Visão Macro do Sistema (organograma)**
Diagrama hierárquico mostrando todos os módulos e fluxos de dados entre eles.

**Página 2 - Detalhamento dos módulos**
Cards explicativos com função, responsável e tipo de dado de cada módulo.

## Estrutura do organograma (Página 1)

```text
                    ┌─────────────────────────────────┐
                    │   APP MOBILE (A USUÁRIA)        │
                    │   Captura contínua + Pânico     │
                    └────────────────┬────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
         [Áudio/Gravação]      [GPS/Telemetria]      [Pânico/SOS]
                │                    │                    │
                └────────────────────┼────────────────────┘
                                     ▼
        ╔════════════════════════════════════════════════════╗
        ║         NÚCLEO AMPARA (Backend + IA)               ║
        ║  • Triagem em tempo real (palavras-chave)          ║
        ║  • Análise MICRO (cada conversa)                   ║
        ║  • Análise MACRO (relatório de saúde)              ║
        ║  • Motor de Risco (Lei Maria da Penha)             ║
        ║  • Disparo de alertas automáticos                  ║
        ╚════════════════════════╤═══════════════════════════╝
                                 │
        ┌────────────┬───────────┼───────────┬────────────┐
        ▼            ▼           ▼           ▼            ▼
  [PORTAL WEB] [GUARDIÕES]  [COPOM     [MÓDULO    [MÓDULO TRIBUNAL]
  da usuária   WhatsApp     190/180]   FORÇA DE    Magistrados
                                       SEGURANÇA]
                                       Polícia
                                            │            │
                                            └─────┬──────┘
                                                  ▼
                                       [MÓDULO ADMIN/GOVERNO]
                                       Dados agregados (RIL)
                                       Transparência pública
```

Setas com legendas curtas indicando o tipo de interação (alerta, consulta, dados anônimos, evidências).

## Conteúdo dos cards (Página 2)

Cada módulo recebe um card com: ícone, nome, função em 1 frase, "o que faz" (3-4 bullets), "interage com".

1. **App Mobile (Usuária)** - Captura áudio, GPS, aciona pânico, recebe orientações da Ampara.

2. **Núcleo Ampara (IA + Backend)** - Cérebro do sistema. Transcreve, analisa risco, dispara alertas, gera relatórios.

3. **Portal Web da Usuária** - Acesso da própria usuária ao seu histórico, gravações, relatório de saúde do relacionamento.

4. **Guardiões (Rede de Apoio)** - Pessoas de confiança notificadas via WhatsApp em situações de risco alto/crítico.

5. **COPOM 190/180** - Chamada automática de voz disparada em pânico ou risco crítico, com contexto da ocorrência.

6. **Módulo Força de Segurança (Ampara Campo)** - API para policiais consultarem em campo se uma vítima/agressor tem histórico no sistema. Retorna tags de risco sem expor PII.

7. **Módulo Tribunal** - Consultas qualificadas para magistrados gerarem análises técnicas (analítica, decisão, parecer) baseadas no histórico Ampara.

8. **Módulo Admin/Governo (RIL + Transparência)** - Dashboard governamental com métricas agregadas e anônimas (k-anonymity), portal público de transparência com mapa de risco por UF.

## Estilo visual

- Paleta institucional Ampara: roxo `#6D28D9`, magenta `#D946EF`, fundo `#F7F7FA`
- Tipografia: Plus Jakarta Sans (títulos) + Inter (corpo)
- Sem travessões (regra do projeto)
- Setas coloridas codificadas por tipo de fluxo (verde=consulta, vermelho=alerta, azul=dados, cinza=anônimo)
- Legenda de cores no rodapé
- Layout limpo, espaço em branco generoso, qualidade para apresentação executiva

## Detalhes técnicos de execução

- Geração via Python com `reportlab` (PDF vetorial nítido)
- Sem dependências externas além das já disponíveis no sandbox
- QA: converter cada página para imagem e inspecionar antes de entregar
- Saída final: `/mnt/documents/Ampara_Organograma_Sistema.pdf`

