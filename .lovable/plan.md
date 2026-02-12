

# Risk Engine -- Plano de Implementacao

## Visao Geral

Criar um motor de avaliacao de risco que consolida dados historicos do banco (alertas de panico, gravacoes, analises, audit logs, perfil do agressor), envia um payload resumido ao Gemini, salva o resultado e plota um grafico de evolucao no dashboard.

---

## 1. Nova Tabela: `risk_assessments`

Criar via migration:

```text
Campos:
- id uuid PK default gen_random_uuid()
- usuario_id uuid NOT NULL (FK -> usuarios.id)
- window_days int NOT NULL (7, 15 ou 30)
- period_start date NOT NULL
- period_end date NOT NULL
- risk_score int NOT NULL (0..100)
- risk_level text NOT NULL
- trend text NOT NULL
- trend_percentage numeric
- fatores jsonb
- resumo_tecnico text
- computed_at timestamptz default now()

Indice: (usuario_id, window_days, period_end DESC)
RLS: policy restritiva (false) igual as demais tabelas sensiveis -- acesso apenas via service_role na edge function.
```

---

## 2. Backend: Nova action `getRiskAssessment` na `web-api`

Adicionar ao switch da `web-api/index.ts` uma action que:

1. Recebe `{ window_days: 7|15|30 }` do frontend
2. Verifica cache: busca `risk_assessments` onde `usuario_id = userId`, `window_days` = pedido, `period_end` = hoje, e `computed_at` < 1h atras
3. Se existe e e recente, retorna direto (sem chamar Gemini)
4. Se nao existe ou esta velho:
   a. Chama `buildRiskHistoryPayload(supabase, userId, windowDays)`
   b. Chama `computeRiskWithGemini(payload)` via Lovable AI Gateway
   c. Salva/upsert em `risk_assessments`
   d. Retorna resultado

### 2a. Funcao `buildRiskHistoryPayload`

Consulta as tabelas existentes e monta o JSON:

| Fonte | Tabela | Dados extraidos |
|---|---|---|
| Alertas de panico | `alertas_panico` | Contagens por dia: ativados, cancelados (manual, timeout, coercao), status |
| Gravacoes | `gravacoes` | Contagens por dia: total de audios, status |
| Segmentos | `gravacoes_segmentos` | Contagem de segmentos por dia |
| Analises de audio | `gravacoes_analises` | Categorias detectadas (ameaca, violencia_fisica, psicologica, moral, patrimonial), nivel_risco por gravacao |
| Perfil agressor | `vitimas_agressores` + `agressores` | Flags: arma, forca_seguranca |
| Audit logs | `audit_logs` | Eventos de coercao (login_coercion etc.) |

Resultado: array `daily_summary` com contagens por dia, `aggressor_profile_flags`, e `last_N_days_totals`. Sem textos sensiveis -- apenas contagens e labels.

### 2b. Funcao `computeRiskWithGemini`

- Envia o payload ao Lovable AI Gateway (`google/gemini-3-flash-preview`) com tool calling para extrair JSON estruturado
- Prompt de sistema instrui o modelo a retornar: `risk_score` (0-100), `risk_level`, `trend`, `trend_percentage`, `fatores_principais[]`, `resumo_tecnico`
- Usa tool calling (structured output) para garantir JSON valido

### 2c. Nova action `getRiskHistory`

Para plotar o grafico, retorna os ultimos N registros de `risk_assessments` para o usuario em uma janela especifica, ordenados por `period_end`.

---

## 3. Frontend: Card "Evolucao do Risco" no Dashboard

### Novo componente: `src/components/dashboard/RiskEvolutionCard.tsx`

- Seletor de janela: 7 / 15 / 30 dias (tabs ou botoes)
- Grafico de linha (`recharts`, ja instalado) mostrando `risk_score` ao longo do tempo
- Badge com nivel atual e cor correspondente (usando o sistema de cores ja existente)
- Indicador de tendencia (seta + percentual)
- 3 bullets com fatores principais
- Estado de loading enquanto computa
- Chamada nao-bloqueante ao montar (useEffect)

### Alteracao em `src/pages/Home.tsx`

Adicionar `<RiskEvolutionCard />` apos o `DeviceStatusCard`.

---

## 4. Sequencia de Implementacao

```text
Passo 1: Migration -- criar tabela risk_assessments + indice + RLS
Passo 2: Edge function -- adicionar buildRiskHistoryPayload, computeRiskWithGemini, actions getRiskAssessment e getRiskHistory na web-api
Passo 3: Deploy web-api
Passo 4: Criar RiskEvolutionCard.tsx com recharts
Passo 5: Integrar no Home.tsx
```

---

## Detalhes Tecnicos

**Prompt Gemini (resumo):**
- System prompt define o modelo como especialista em avaliacao de risco de violencia domestica
- Recebe apenas contagens e flags, nunca textos sensiveis
- Retorna via tool calling: `{ risk_score, risk_level, trend, trend_percentage, fatores_principais, resumo_tecnico }`

**Cache:**
- Chave: `(usuario_id, window_days, period_end = hoje)`
- TTL: 1 hora (comparando `computed_at` com `now()`)
- Se cache valido, zero chamadas ao Gemini

**Grafico:**
- `LineChart` do recharts com area preenchida
- Cor da linha dinamica baseada no nivel de risco atual
- Tooltip mostrando score e data
- Responsivo para mobile

**Seguranca:**
- Tabela com RLS restritiva (acesso bloqueado via client direto)
- Acesso somente via `web-api` com `service_role_key`
- Nenhum texto sensivel exposto -- apenas scores, labels e contagens

