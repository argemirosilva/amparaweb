

## Problema Identificado

O card do dispositivo mostra "Monitorando" porque:
1. O campo `is_monitoring` na tabela `device_status` ainda esta `true` (o app mobile continua reportando assim nos pings)
2. O hook `useDeviceStatus` copia `is_monitoring` diretamente do banco **sem validar** se existe uma sessao de monitoramento ativa em `monitoramento_sessoes`

O `is_recording` ja tem essa validacao cruzada, mas `is_monitoring` nao.

## Plano de Correcao

### 1. Corrigir o hook useDeviceStatus (correcao definitiva)

No arquivo `src/hooks/useDeviceStatus.ts`, alterar a linha 123 para aplicar a mesma logica de validacao cruzada:

- Se `device_status.is_monitoring = true` mas **nao existe** sessao ativa em `monitoramento_sessoes`, sobrescrever para `false`
- Isso garante que mesmo que o app mobile envie `is_monitoring: true` por engano, o dashboard nao mostra o indicador se nao houver sessao real

```typescript
// Antes:
is_monitoring: deviceRes.data.is_monitoring,

// Depois:
is_monitoring: deviceRes.data.is_monitoring && hasActiveMonitor ? true : false,
```

### 2. Corrigir o dado no banco (correcao imediata)

Criar uma migracao para resetar `is_monitoring = false` no `device_status` da usuaria, eliminando o estado inconsistente atual.

### Secao Tecnica

**Arquivo modificado:** `src/hooks/useDeviceStatus.ts`  
**Linha afetada:** 123  
**Migracao SQL:** UPDATE em `device_status` para resetar `is_monitoring`

