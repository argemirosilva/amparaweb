

# Diagnóstico: Sessão Ativa Presa com Segmentos Não Processados

## Problema Encontrado

A sessão `ad835fb8` está com status `ativa` e possui **10 segmentos** (~271 segundos de áudio) no R2, mas nunca foi selada/finalizada. O motivo:

```text
Sessão ad835fb8 → device_id: 3dcb0b26
Device atual    → device_id: e5cefd10 (online, is_recording=false)
```

Houve uma **rotação de dispositivo** que não selou a sessão anterior. O `session-maintenance` não a captura porque:

1. **Orphan check (Step 0)**: Sessão tem segmentos → ignorada (corretamente)
2. **Interruption check (Step 0b)**: Procura por `device_status` com `device_id = 3dcb0b26`, mas esse device já não existe na tabela → nunca encontra
3. **Window expiry (Step 1)**: `window_end_at` é NULL → ignorada

## Plano de Correção

### 1. Correção imediata: Selar a sessão presa
- Atualizar o status da sessão `ad835fb8` para `aguardando_finalizacao` com `sealed_reason: 'device_rotation_orphan'`
- Disparar `session-maintenance` com `skip_tolerance: true` para processar imediatamente

### 2. Correção estrutural no `session-maintenance/index.ts`
Adicionar um **Step 0c** que detecta sessões `ativa` cujo `device_id` não corresponde ao dispositivo atualmente vinculado ao usuário:

```text
Para cada sessão ativa:
  1. Buscar device_status do user
  2. Se device_id da sessão ≠ device_id atual → selar como "device_rotation_orphan"
```

Isso garante que futuras rotações de dispositivo que não selarem corretamente a sessão anterior serão capturadas pelo cron automático.

### Arquivos Alterados
- `supabase/functions/session-maintenance/index.ts` — adicionar Step 0c para detectar sessões órfãs por rotação de dispositivo

