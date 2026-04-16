

## Módulo FONAR Dinâmico — Camada Observadora Independente

Vou implementar o **FONAR (Formulário Nacional de Avaliação de Risco)** como módulo desacoplado, em paralelo ao motor existente, sem tocar em uma única linha do core de análise.

### Princípio arquitetural

```text
CORE AMPARA (intocado)
   │
   ├─ analysis_micro_results (insert)
   ├─ analysis_macro_reports (insert)
   └─ alertas_panico (insert)
            │
            ▼
      [DB Triggers AFTER INSERT]
            │
            ▼
      fonar_signals (fila própria)
            │
            ▼
      Edge Function: fonar-worker
            │
            ├─ classifica relevância
            ├─ cria fonar_review_suggestions
            └─ recalcula fonar_risk_assessment
            │
            ▼
       UI: bloco "Meu FONAR" (Home)
```

O core continua publicando seus dados normalmente. O FONAR observa **a posteriori** via triggers leves. Se o worker falhar, o core não percebe.

### 1. Banco de dados (migration nova, isolada)

Tabelas com prefixo `fonar_`, todas com RLS própria. Zero alteração em tabelas existentes.

| Tabela | Função |
|---|---|
| `fonar_submissions` | submissão atual da usuária (questionário preenchido) |
| `fonar_versions` | histórico versionado de cada revisão |
| `fonar_signals` | eventos consumidos da AMPARA (fila) |
| `fonar_review_suggestions` | sugestões geradas para a usuária revisar |
| `fonar_risk_assessments` | risco_fonar calculado (paralelo ao risco_ampara) |
| `fonar_logs` | auditoria interna do módulo |
| `fonar_settings` | feature flag global `FONAR_ENABLED` |

**Triggers leves** em `analysis_micro_results`, `analysis_macro_reports` e `alertas_panico`: apenas `INSERT INTO fonar_signals` em bloco try/exception (qualquer erro é silenciado para não afetar o core).

### 2. Feature flag (modo SAFE)

`fonar_settings.enabled = true/false`. Quando `false`:
- Triggers fazem `RETURN NEW` imediato sem inserir signal
- Worker retorna 200 vazio
- UI esconde o bloco "Meu FONAR"
- Rollback é apenas um UPDATE

### 3. Edge Functions novas

| Função | Responsabilidade |
|---|---|
| `fonar-api` | CRUD do questionário, listar sugestões, aceitar/ignorar revisão |
| `fonar-worker` | consome `fonar_signals` queued, classifica relevância (baixa/média/alta/crítica), gera `fonar_review_suggestions`, recalcula `fonar_risk_assessments` |

Worker roda via cron (a cada 1min) ou invocação manual. **Nunca chamado pelo core.**

### 4. Eventos consumidos

- `analise_micro_detectada` → trigger em `analysis_micro_results`
- `analise_macro_detectada` → trigger em `analysis_macro_reports`
- `evento_critico_identificado` / `mudanca_de_padrao` → derivado do `risk_level` e `cycle_phase`
- `acionamento_panico` → trigger em `alertas_panico`

Todos com namespace próprio (`fonar_*`) nos signals.

### 5. UI (zero impacto no existente)

**Home (`src/pages/Home.tsx`)** — adicionar **um único bloco** após `MonitoringStatusCard`:

```text
┌─────────────────────────────────────┐
│ Meu FONAR              [revisar →]  │
│                                     │
│ ┌──────────────┬──────────────────┐ │
│ │ Risco AMPARA │ Risco FONAR      │ │
│ │ Alto • 72    │ Moderado • 48    │ │
│ │ (motor IA)   │ (autoavaliação)  │ │
│ └──────────────┴──────────────────┘ │
│                                     │
│ ⚠ 2 sugestões de revisão pendentes  │
└─────────────────────────────────────┘
```

Card unificado com **duas colunas distintas e rotuladas**, deixando claro que são avaliações independentes.

**Novas rotas** (não substituem nenhuma):
- `/fonar` — wizard guiado de preenchimento (passo a passo)
- `/fonar/revisar/:suggestionId` — revisão pontual disparada por sugestão
- `/fonar/historico` — histórico de versões

**Componentes novos** em `src/components/fonar/`:
- `FonarWizard.tsx` — passos sequenciais com salvamento progressivo
- `FonarHomeBlock.tsx` — card da Home
- `FonarRiskComparison.tsx` — duas colunas de risco
- `FonarSuggestionCard.tsx` — sugestão individual

### 6. Notificações independentes

Canal próprio: lista de sugestões dentro do bloco "Meu FONAR". **Não usa toast crítico**, **não compete com alertas de pânico**, **não dispara WhatsApp**. Apenas badge de contagem no card.

### 7. Garantias de não-interferência

- ✅ Nenhuma edge function existente é editada
- ✅ Nenhuma tabela existente recebe coluna nova
- ✅ Triggers usam `EXCEPTION WHEN OTHERS THEN RETURN NEW` (silenciam falhas)
- ✅ Feature flag desliga tudo em 1 update SQL
- ✅ Bloco UI só renderiza se `FONAR_ENABLED=true`
- ✅ `risco_fonar` nunca é misturado com `risco_ampara` no core

### 8. Wizard FONAR (passos)

Baseado no formulário oficial brasileiro de avaliação de risco em violência doméstica:
1. Identificação básica
2. Histórico de violência (física, psicológica, sexual, patrimonial, moral)
3. Ameaças e armas
4. Ciclo e frequência
5. Filhos e dependentes
6. Rede de apoio
7. Contexto socioeconômico
8. Revisão final → gera versão imutável

### Arquivos a criar

**Migration:**
- 1 migration SQL com 7 tabelas + 3 triggers + RLS + seed do flag

**Edge Functions:**
- `supabase/functions/fonar-api/index.ts`
- `supabase/functions/fonar-worker/index.ts`

**Frontend:**
- `src/pages/Fonar.tsx` (wizard)
- `src/pages/FonarHistorico.tsx`
- `src/components/fonar/FonarHomeBlock.tsx`
- `src/components/fonar/FonarWizard.tsx`
- `src/components/fonar/FonarRiskComparison.tsx`
- `src/components/fonar/FonarSuggestionCard.tsx`
- `src/services/fonarService.ts`
- `src/hooks/useFonar.ts`

**Edições mínimas (apenas adição):**
- `src/App.tsx` — 3 rotas novas
- `src/pages/Home.tsx` — 1 import + 1 componente no final do grid

