

## Retornar sucesso ao rejeitar GPS por device mismatch/not registered

### Problema
Quando o backend rejeita um envio de GPS por `NO_DEVICE_REGISTERED` ou `DEVICE_MISMATCH` no handler `enviarLocalizacaoGPS`, ele retorna `success: false` com HTTP 403. Isso faz o app tratar como erro, quando na verdade deveria simplesmente ignorar silenciosamente.

### Mudanca

**Arquivo:** `supabase/functions/mobile-api/index.ts`

1. **Linha 1377** (`NO_DEVICE_REGISTERED`): Trocar de `jsonResponse({ success: false, error: "NO_DEVICE_REGISTERED" }, 403)` para `jsonResponse({ success: true, message: "GPS ignorado - dispositivo nao registrado", skipped: true })` (HTTP 200).

2. **Linha 1385** (`DEVICE_MISMATCH`): Trocar de `jsonResponse({ success: false, error: "DEVICE_MISMATCH" }, 403)` para `jsonResponse({ success: true, message: "GPS ignorado - dispositivo diferente", skipped: true })` (HTTP 200).

O campo `skipped: true` permite que o app saiba que o GPS nao foi gravado, mas sem tratar como erro.

### Secao Tecnica

**Arquivo modificado:** `supabase/functions/mobile-api/index.ts`
- Linha 1377: Trocar retorno de erro 403 para sucesso 200 com `skipped: true`
- Linha 1385: Trocar retorno de erro 403 para sucesso 200 com `skipped: true`

