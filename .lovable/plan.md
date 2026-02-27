

## Garantir que "Monitorando" so apareca apos confirmacao do dispositivo

### Problema
O status "Monitorando" aparece no dashboard sem o dispositivo ter confirmado que iniciou. Isso acontece porque o `syncConfigMobile` cria sessoes com `status: "ativa"` imediatamente (baseado no agendamento), e o ping aceita flags `is_monitoring`/`is_recording` do payload sem validacao.

### Mudancas

#### 1. Remover aceitacao de `is_recording` e `is_monitoring` no ping
**Arquivo:** `supabase/functions/mobile-api/index.ts` (linhas 611-612)

Remover as duas linhas que permitem o ping sobrescrever esses flags. Eles devem ser controlados exclusivamente por `reportarStatusMonitoramento` e `reportarStatusGravacao`.

#### 2. Usar status intermediario `aguardando_dispositivo` nas sessoes criadas pelo syncConfig
**Arquivo:** `supabase/functions/mobile-api/index.ts`

Nas 3 insercoes de `monitoramento_sessoes` dentro do `syncConfigMobile` (linhas 828, 874, e possivelmente outras), trocar `status: "ativa"` por `status: "aguardando_dispositivo"`.

O frontend ja filtra por `status: "ativa"`, entao sessoes em `aguardando_dispositivo` nao aparecerao como ativas.

#### 3. Promover sessao para "ativa" quando o dispositivo confirmar
**Arquivo:** `supabase/functions/mobile-api/index.ts`

- Em `handleReportarStatusMonitoramento` (linha 2049): quando `isActive` (janela_iniciada/ativado/retomado), alem de atualizar `device_status`, promover sessoes `aguardando_dispositivo` para `ativa` no mesmo device_id.

- Em `handleReportarStatusGravacao` (linhas 2129-2134): ao buscar sessao existente, incluir `aguardando_dispositivo` no filtro (usar `.in("status", ["ativa", "aguardando_dispositivo"])`) e promover para `ativa`.

### Secao Tecnica

**Arquivos modificados:**

1. `supabase/functions/mobile-api/index.ts`:
   - Linha 611-612: Remover `is_recording` e `is_monitoring` do ping
   - Linhas 828, 874: Trocar `status: "ativa"` por `status: "aguardando_dispositivo"` no syncConfig
   - Linha ~2049-2057: Em `handleReportarStatusMonitoramento`, promover sessao `aguardando_dispositivo` -> `ativa` quando `isActive`
   - Linha ~2129-2134: Em `handleReportarStatusGravacao`, incluir `aguardando_dispositivo` no filtro e promover

2. `src/hooks/useDeviceStatus.ts`: Nenhuma mudanca necessaria — a validacao cruzada existente (`is_monitoring && hasActiveMonitor`) ja cobre o caso corretamente.
