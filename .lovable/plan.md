
## Documentação API Mobile — v2.1 (Concluído)

### Alterações realizadas

**1. Removido `createTestTrackingLink`**
- Removido handler do backend (`mobile-api/index.ts`)
- Removido case do switch router
- Não documentado no DocApi.tsx

**2. Parâmetros adicionados (Item 2 do plano)**
- `pingMobile`: adicionado `device_model` (alias de `dispositivo_info`)
- `acionarPanicoMobile`: adicionado `localizacao` (objeto alternativo para coordenadas)
- `enviarLocalizacaoGPS`: documentado comportamento de deduplicação via `timestamp_gps`

**3. Aliases documentados (Item 3)**
- `reportarStatusGravacao` agora lista aliases: `iniciarGravacao`, `pararGravacao`, `finalizarGravacao`
- Removido endpoint separado `iniciarGravacao` — agora é um alias com badge visual
- Adicionada seção informativa "Aliases de Actions"

**4. Respostas detalhadas (Item 4)**
- `receberAudioMobile`: documentados 3 fluxos (sessão ativa, segmento tardio, gravação órfã)
- `reportarStatusGravacao`: documentados 3 status de resposta (ativa, aguardando_finalizacao, descartada)
- Campo `notes` adicionado à interface `Endpoint` para notas de implementação

**5. Seções informativas (Item 5)**
- Nova card "Deduplicação GPS & Janela de Graça (Grace Window)"
- Nova card "Aliases de Actions" com tabela
- Rate limiting atualizado com `change_coercion_password`
- Anti-coerção atualizado com `change_coercion_password`
- Versão atualizada para v2.1
