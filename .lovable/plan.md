

## Tornar pingMobile e syncConfigMobile read-only

### Status: ✅ Implementado

### Mudanças realizadas

**1. pingMobile** — Tornado read-only para vínculo de dispositivo:
- Se o `device_id` do ping já está registrado: atualiza normalmente.
- Se o `device_id` NÃO está registrado: ignora silenciosamente, retorna `{ success: true, skipped: true, status: "device_not_bound" }`.
- O vínculo de dispositivo só acontece no login.

**2. syncConfigMobile** — Tornado read-only para sessões de monitoramento:
- Removida toda a lógica de criação automática de sessões (`origem: automatico`).
- Removida a rotação de dispositivos (que usava `ip` inexistente, causando `ReferenceError`).
- Agora apenas consulta se existe uma sessão ativa e retorna o `sessao_id`.
- A criação de sessões acontece exclusivamente via `reportarStatusGravacao` / `reportarStatusMonitoramento`.
