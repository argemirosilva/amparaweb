

## Mostrar indicador de gravacao junto com o banner de panico

### Problema

Duas causas impedem o label "Gravando" de aparecer durante panico ativo:

1. **Frontend** (`DeviceStatusCard.tsx`, linha 179): a condicao `&& !panicActive` esconde o indicador de gravacao/monitoramento quando ha panico ativo
2. **Backend** (`handleAcionarPanico`): ao acionar panico, o `device_status` e resetado com `is_monitoring: false`, fazendo o frontend achar que nao ha atividade — mesmo que a sessao de monitoramento exista no banco

### Correcoes

#### 1. Frontend: Remover filtro `!panicActive` do indicador

No `DeviceStatusCard.tsx`, linha 179, mudar:

```
(device?.is_recording || device?.is_monitoring) && !panicActive
```

Para:

```
(device?.is_recording || device?.is_monitoring)
```

E ajustar o posicionamento (`top`) para que o indicador apareca abaixo do banner de panico quando ambos estao ativos (ja existe logica parcial para isso com `panicActive ? "top-[24px]" : "top-0"`).

#### 2. Backend: Nao resetar `is_monitoring` ao acionar panico

No `handleAcionarPanico` do `mobile-api/index.ts`, remover o update que seta `is_monitoring: false` no `device_status`. O panico cria sua propria sessao de monitoramento — resetar o flag contradiz isso.

Manter apenas o `sealAllActiveSessions` para fechar sessoes anteriores (de agendamento/manual), mas a nova sessao de panico que e criada pelo `reportarStatusGravacao` deve poder setar os flags normalmente.

#### 3. Backend: Garantir que `reportarStatusGravacao` com origem panico sete os flags

Verificar que quando o dispositivo reporta `status: "iniciada"` com `origem: "botao_panico"`, os flags `is_recording: true` e/ou `is_monitoring: true` sao setados no `device_status`.

### Secao Tecnica

**Arquivos modificados:**
- `src/components/dashboard/DeviceStatusCard.tsx` — Remover `&& !panicActive` da condicao de exibicao do indicador (linha 179)
- `supabase/functions/mobile-api/index.ts` — Em `handleAcionarPanico`, remover o reset de `is_monitoring: false` no device_status

