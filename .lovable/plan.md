

# AMPARA Tribunal - Motor de IA Multi-Saída + Enriquecimento de Dados

## Visão Geral

Criar o módulo AMPARA Tribunal com 3 modos de saída de IA (Analítico, Despacho, Parecer), API dedicada com autenticação dupla (API key + sessão), e um sistema de enriquecimento bidirecional onde dados fornecidos pelo tribunal são vinculados a vítimas e agressores existentes.

---

## Arquitetura

```text
┌─────────────────────────────────────────────────────────┐
│  Fontes de dados                                        │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ Dados AMPARA │  │ Dados Tribunal (input externo)   │ │
│  │ (gravações,  │  │ (processos, BOs, depoimentos,    │ │
│  │  análises,   │  │  medidas protetivas, etc.)        │ │
│  │  agressores) │  │                                  │ │
│  └──────┬───────┘  └──────────────┬───────────────────┘ │
│         │                         │                     │
│         ▼                         ▼                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Camada intermediária (analysis_object)              ││
│  │ { risco, indicadores, fatores, padroes }            ││
│  └──────────────────────┬──────────────────────────────┘│
│                         │                               │
│         ┌───────────────┼───────────────┐               │
│         ▼               ▼               ▼               │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐           │
│   │Analítico │   │ Despacho │   │ Parecer  │           │
│   │  (JSON)  │   │  (Texto) │   │ (Texto)  │           │
│   └──────────┘   └──────────┘   └──────────┘           │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Novas Tabelas

### `tribunal_api_keys` - Chaves de API por tribunal
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | Tribunal vinculado |
| key_hash | text | Hash SHA-256 da API key |
| key_prefix | text | Primeiros 8 chars (para identificação) |
| label | text | Nome descritivo |
| ativo | boolean | |
| created_at / expires_at | timestamptz | |

### `tribunal_consultas` - Log de consultas
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| tenant_id | uuid | Tribunal solicitante |
| api_key_id | uuid | Chave usada |
| modo_saida | text | analitico / despacho / parecer |
| input_hash | text | Hash dos dados de entrada |
| analysis_object | jsonb | Objeto intermediário |
| output_json | jsonb | Saída no modo analítico |
| output_text | text | Saída nos modos despacho/parecer |
| usuario_id | uuid | Vítima vinculada (se identificada) |
| agressor_id | uuid | Agressor vinculado (se identificado) |
| model | text | Modelo IA usado |
| prompt_version | text | |
| created_at | timestamptz | |

### `tribunal_prompts` - Prompts versionáveis
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| tipo | text | base / analitico / despacho / parecer |
| conteudo | text | Corpo do prompt |
| versao | integer | Auto-incrementado por tipo |
| ativo | boolean | Apenas 1 ativo por tipo |
| created_at / updated_at | timestamptz | |
| created_by | uuid | Admin que criou |

### `tribunal_dados_externos` - Dados fornecidos pelo tribunal (enriquecimento)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| consulta_id | uuid FK tribunal_consultas | Consulta de origem |
| tenant_id | uuid | Tribunal de origem |
| tipo_dado | text | processo, bo, medida_protetiva, depoimento, laudo, outro |
| numero_referencia | text | Número do processo/BO |
| resumo | text | Resumo do conteúdo |
| dados_json | jsonb | Dados estruturados completos |
| usuario_id | uuid | Vítima vinculada (nullable) |
| agressor_id | uuid | Agressor vinculado (nullable) |
| data_referencia | date | Data do documento original |
| created_at | timestamptz | |

RLS: Todas as tabelas com acesso bloqueado direto (service role only via edge function).

---

## 2. Edge Function: `tribunal-api`

Endpoint único: `POST /functions/v1/tribunal-api`

### Autenticação dupla
- **API Key**: Header `X-Tribunal-Key` - para integração externa de sistemas judiciais
- **Sessão admin**: `session_token` no body - para uso via painel admin

### Actions

| Action | Descrição |
|--------|-----------|
| `consulta` | Recebe dados, gera análise, retorna no modo escolhido |
| `listConsultas` | Histórico de consultas do tribunal |
| `getConsulta` | Detalhe de uma consulta (com possibilidade de regenerar em outro modo) |
| `regenerar` | Reutiliza `analysis_object` e gera saída em modo diferente |

### Payload `consulta`
```json
{
  "modo_saida": "analitico|despacho|parecer",
  "dados_vitima": {
    "nome": "...", "cpf_last4": "...", "telefone": "..."
  },
  "dados_agressor": {
    "nome": "...", "cpf_last4": "...", "aliases": []
  },
  "dados_processo": {
    "tipo": "processo|bo|medida_protetiva",
    "numero": "...",
    "resumo": "...",
    "conteudo": "texto livre ou estruturado"
  },
  "incluir_dados_ampara": true
}
```

### Fluxo interno
1. Autenticar (API key ou sessão)
2. Identificar vítima/agressor no banco (fuzzy match por nome + CPF last4)
3. Se `incluir_dados_ampara=true`, buscar análises MICRO/MACRO, gravações, risk_assessments
4. Armazenar dados externos em `tribunal_dados_externos` vinculando a usuário/agressor
5. Montar `analysis_object` intermediário (risco, indicadores, fatores, padrões)
6. Compor prompt: `prompt_base + prompt_{modo}`
7. Chamar IA (Gemini 2.5 Pro via Lovable AI)
8. Salvar resultado em `tribunal_consultas`
9. Retornar saída formatada

---

## 3. Enriquecimento Bidirecional

O ponto central da sua pergunta. Quando o tribunal envia dados:

- **Vítima**: dados como endereço atualizado, medidas protetivas vigentes, histórico processual são armazenados em `tribunal_dados_externos` vinculados ao `usuario_id`
- **Agressor**: informações como processos anteriores, condenações, medidas cautelares são vinculados ao `agressor_id`
- Os dados NÃO sobrescrevem os campos existentes nas tabelas `usuarios`/`agressores` - ficam como camada adicional consultável
- Na hora da análise, o motor de IA recebe tanto os dados internos AMPARA quanto os dados externos do tribunal
- Futuramente, admins podem visualizar esses dados complementares no perfil do agressor/vítima

---

## 4. Sistema de Prompts

4 prompts gerenciáveis via admin:

- **prompt_base**: Papel do modelo, limites éticos, regras de linguagem, critérios de avaliação
- **prompt_analitico**: Instruções para saída JSON estruturada (score, indicadores, fatores)
- **prompt_despacho**: Instruções para texto institucional formal contínuo, sem JSON
- **prompt_parecer**: Instruções para parecer técnico com seções (introdução, análise, padrões, risco, conclusão)

Composição: `prompt_final = prompt_base + "\n\n" + prompt_{modo} + "\n\nDADOS:\n" + dados_json`

---

## 5. Interface Admin

### Nova rota: `/admin/tribunal`
- **Consultas**: Tabela com histórico de consultas, filtros por tribunal/modo/data
- **Nova Consulta**: Formulário para consulta manual (identificar vítima/agressor, colar dados, escolher modo)
- **Prompts**: Editor de prompts com preview, versionamento e ativação (similar ao `AdminPromptsIA` existente, mas com 4 slots)
- **API Keys**: Gerenciar chaves de API por tribunal/entidade

### Integração com admin existente
- Nova entrada no sidebar do AdminLayout
- Protegida por role `administrador` ou `super_administrador`

---

## 6. Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar 4 tabelas + RLS + seeds de prompts padrão |
| `supabase/functions/tribunal-api/index.ts` | Nova edge function |
| `supabase/functions/_shared/buildTribunalPrompts.ts` | Builder de prompts do tribunal |
| `src/pages/admin/AdminTribunal.tsx` | Página principal do módulo |
| `src/components/tribunal/TribunalConsultas.tsx` | Lista de consultas |
| `src/components/tribunal/TribunalNovaConsulta.tsx` | Formulário de consulta manual |
| `src/components/tribunal/TribunalPrompts.tsx` | Editor de prompts |
| `src/components/tribunal/TribunalApiKeys.tsx` | Gestão de API keys |
| `src/App.tsx` | Adicionar rota `/admin/tribunal` |
| `src/components/institucional/AdminLayout.tsx` | Adicionar item no sidebar |
| `supabase/config.toml` | Registrar `tribunal-api` com `verify_jwt = false` |

---

## 7. Segurança

- API keys com hash SHA-256 (nunca armazenar em texto plano)
- Rate limiting por API key (via `rate_limit_attempts`)
- Audit log de todas as consultas
- Dados externos anonimizados com a mesma lógica existente
- RLS bloqueando acesso direto (service role only)
- Dados de PII do tribunal mascarados no log

