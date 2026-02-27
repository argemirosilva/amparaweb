

## Tornar pingMobile read-only para vinculo de dispositivo

### Problema atual
O `handlePing` ainda faz rotacao de dispositivo quando nao ha sessao ativa. Dois dispositivos com device_ids diferentes (`af9a2be7...` e `37CA6534...`) ficam alternando pings, e como nao ha sessao ativa no momento, cada ping deleta o outro e se registra. Isso cria um loop de rotacao infinito que impede gravacoes de funcionar.

### Mudanca proposta

**Arquivo:** `supabase/functions/mobile-api/index.ts` (handlePing, linhas ~616-673)

Substituir toda a logica do bloco `else` (quando `existing` e null, ou seja, device_id nao esta registrado) por um comportamento puramente passivo:

- Se o `device_id` do ping ja esta registrado para o usuario: **atualizar** normalmente (como ja faz).
- Se o `device_id` NAO esta registrado: **ignorar silenciosamente** o ping. Retornar `{ success: true, skipped: true, status: "device_not_bound" }`. Nao deletar, nao inserir, nao rotacionar.

O vinculo de dispositivo so deve acontecer no **login** (handleLogin). O ping nunca altera quem e o dispositivo ativo.

### Secao tecnica

**Arquivo modificado:** `supabase/functions/mobile-api/index.ts`

Bloco a substituir (linhas 621-673 aproximadamente):

```text
ANTES (else branch):
  - Consulta currentDevice
  - Consulta activeSession e activePanic
  - Se sessao ativa: ignora (ja implementado)
  - Se nao: deleta device antigo, insere novo

DEPOIS (else branch):
  - Log: "Ping from unbound device {deviceId}, ignoring"
  - Return jsonResponse({ success: true, skipped: true, status: "device_not_bound", message: "Dispositivo nao vinculado - faca login para vincular" })
```

Isso elimina completamente a rotacao de dispositivo no ping, tornando-o read-only no que diz respeito ao vinculo. O login ja insere o device_status corretamente.

