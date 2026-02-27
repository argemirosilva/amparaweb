

## Corrigir: Uma sessao por dispositivo — novo dispositivo mata a anterior

### Problema identificado

Na logica de `syncConfigMobile` (linha 793-838), quando o horario esta dentro de um periodo agendado e ja existe uma sessao ativa, o codigo simplesmente reutiliza o `sessaoId` da sessao existente — **mesmo que ela pertenca a um dispositivo diferente**.

```text
Fluxo atual (bugado):
  novo device pinga -> dentro do horario? -> existe sessao ativa? -> SIM -> reutiliza sessao (mesmo de outro device)

Fluxo correto:
  novo device pinga -> dentro do horario? -> existe sessao ativa?
    -> SIM, mesmo device -> reutiliza
    -> SIM, outro device -> sela a antiga, reseta flags do device antigo, cria nova sessao
    -> NAO -> cria nova sessao
```

### Correcao

**Arquivo:** `supabase/functions/mobile-api/index.ts`

Na secao de `syncConfigMobile` (~linhas 793-838), alterar o bloco `else` (quando `existingSession` existe) para verificar se o `device_id` da sessao existente e diferente do device atual. Se for diferente:

1. Chamar `sealAllActiveSessions(supabase, user.id, "device_rotation", ip)` para selar a sessao antiga
2. Resetar os flags `is_recording` e `is_monitoring` do device antigo no `device_status`
3. Criar uma nova sessao para o novo dispositivo

Se for o mesmo device, manter o comportamento atual (reutilizar a sessao).

### Secao Tecnica

**Unico arquivo modificado:** `supabase/functions/mobile-api/index.ts`

Trecho a alterar (linhas ~836-838):

De:
```typescript
} else {
  sessaoId = existingSession.id;
}
```

Para:
```typescript
} else if (existingSession.device_id === deviceId) {
  // Same device — reuse session
  sessaoId = existingSession.id;
} else {
  // Different device — seal old session and create new one
  await sealAllActiveSessions(supabase, user.id, "device_rotation");
  // Reset old device flags
  await supabase
    .from("device_status")
    .update({ is_recording: false, is_monitoring: false })
    .eq("user_id", user.id)
    .neq("device_id", deviceId);
  // Create new session for new device (same logic as !existingSession block above)
  // ... (replicar criacao de sessao com window_start/end)
}
```

A logica de criacao da nova sessao sera identica ao bloco ja existente (linhas 804-835), apenas replicada no novo branch.
