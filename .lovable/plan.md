

## ✅ Garantir que "Monitorando" so apareca apos confirmacao do dispositivo

### Implementado

1. **Ping não aceita mais `is_recording`/`is_monitoring`** — flags controlados exclusivamente por `reportarStatusMonitoramento` e `reportarStatusGravacao`
2. **syncConfigMobile cria sessões com `aguardando_dispositivo`** — não aparecem como ativas no frontend
3. **Promoção automática** — `handleReportarStatusMonitoramento` promove sessões para `ativa` quando dispositivo confirma (`janela_iniciada`/`ativado`/`retomado`)
4. **`handleReportarStatusGravacao`** — busca sessões `ativa` ou `aguardando_dispositivo`, cria nova sessão já como `ativa` (confirmação implícita)
5. **`sealAllActiveSessions`** — também sela sessões `aguardando_dispositivo`
6. **Consultas de sessão existente no syncConfig** — incluem `aguardando_dispositivo` para evitar duplicação
