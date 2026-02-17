

## Correcao: Aceitar "manual" como motivo de seal imediato

### Problema identificado
O app Android envia `motivo_parada: "manual"` quando o usuario para a gravacao pelo botao. O backend so aceita `"botao_manual"` e `"parada_panico"` na lista `MOTIVOS_SEAL_IMEDIATO`, fazendo a sessao ficar presa no status "ativa" em vez de ser selada para processamento.

### Evidencia nos logs
- **14:23:09** - `session_created`
- **14:23:40** - `segment_received` (segmento 1)
- **14:24:08** - `recording_finalized_no_seal` com motivo `manual` (backend nao selou)
- **14:24:10** - `segment_received` (segmento 2 chegou apos finalizacao)

### Alteracao

**Arquivo:** `supabase/functions/mobile-api/index.ts`

**Linha 1663** - Adicionar `"manual"` a lista de motivos de seal imediato:

```text
// ANTES:
const MOTIVOS_SEAL_IMEDIATO = ["botao_manual", "parada_panico"];

// DEPOIS:
const MOTIVOS_SEAL_IMEDIATO = ["botao_manual", "manual", "parada_panico"];
```

Essa e a unica alteracao necessaria. Com isso, quando o app enviar `motivo_parada: "manual"`, o backend vai selar a sessao imediatamente (status `aguardando_finalizacao`), permitindo que o `session-maintenance` processe a concatenacao dos segmentos e gere a gravacao final.

### Ponto de atencao
O segmento 2 chegou **2 segundos apos** a finalizacao. Isso pode ocorrer por latencia de rede. O fluxo de seal ja lida com segmentos existentes na tabela no momento do processamento, entao isso nao deve ser um problema funcional.
