

# Plano: Enriquecer Triagem com Contexto de Ameaca

## Problema atual

A triagem retorna apenas `nivel_risco` (sem_risco/moderado/alto/critico) e `motivo` (texto curto). Quando o sistema dispara WhatsApp ou liga para COPOM, nao tem como informar **o que especificamente aconteceu** -- se foi ameaca de morte, agressao fisica em curso, etc.

## Proposta

Expandir o JSON de retorno da IA de triagem para incluir **flags contextuais** que descrevem a situacao concreta. Esses flags sao salvos no banco e passados adiante para WhatsApp e COPOM.

### Novo formato do JSON de triagem

```json
{
  "nivel_risco": "critico",
  "motivo": "Ameaca de morte com mencao a faca",
  "contexto_emergencia": {
    "ameaca_morte": true,
    "agressao_fisica": false,
    "agressao_em_curso": false,
    "ameaca_agressao_fisica": true,
    "pedido_socorro": false,
    "mencao_arma": true,
    "descricao_curta": "Agressor ameacou matar vitima com faca"
  }
}
```

Os campos booleanos sao rapidos de processar e o `descricao_curta` e uma frase humana para usar nas notificacoes.

## Alteracoes

### 1. Prompt de triagem (buildAnalysisPrompt.ts)

Atualizar o prompt padrao para solicitar o objeto `contexto_emergencia` no JSON de retorno, alem do `nivel_risco` e `motivo` ja existentes.

### 2. Coluna no banco (migration)

Adicionar coluna `triage_contexto` (JSONB, nullable) na tabela `gravacoes_segmentos` para persistir os flags.

### 3. segment-triage/index.ts

- `classifyRisk` passa a retornar um objeto `{ nivel_risco, motivo, contexto_emergencia }` em vez de apenas string.
- Salvar `triage_contexto` junto com `triage_risco` e `triage_transcricao`.
- Passar `contexto_emergencia` para `fireWhatsApp` e `fireCopomCall`.

### 4. send-whatsapp/index.ts

- Receber campo opcional `contexto` no body.
- Usar `contexto.descricao_curta` como parametro adicional no template WhatsApp (se o template suportar), ou incluir no parametro existente de endereco/tipo.
- Salvar contexto no audit log.

### 5. copom-outbound-call/index.ts

- Receber campo opcional `contexto` no body.
- Incluir `descricao_curta` no payload de contexto da ligacao para que o operador saiba o que aconteceu.

### 6. Admin UI (AdminPromptsIA.tsx)

- Atualizar o placeholder do prompt de triagem para refletir o novo formato JSON esperado.

## Arquivos modificados

| Arquivo | Alteracao |
|---------|----------|
| Migration SQL | ADD COLUMN `triage_contexto` JSONB |
| `_shared/buildAnalysisPrompt.ts` | Novo prompt padrao com contexto_emergencia |
| `segment-triage/index.ts` | Parse e persistencia do contexto |
| `send-whatsapp/index.ts` | Receber e usar contexto nas msgs |
| `copom-outbound-call/index.ts` | Receber e usar contexto na ligacao |
| `AdminPromptsIA.tsx` | Placeholder atualizado |

