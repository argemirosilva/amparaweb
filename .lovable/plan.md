

## Enriquecer Documentacao da API com Fluxos de Uso Detalhados

### Resumo

A documentacao atual lista endpoints isoladamente. Faltam guias claros de **como usar a API na pratica** — fluxos sequenciais, ordem correta de chamadas, tratamento de erros, e exemplos realistas. A proposta adiciona secoes de fluxo visual e orientacoes praticas para cada fase.

---

### 1. Nova secao "Guia de Integracao Rapida" (apos Connection Info)

Card com checklist sequencial mostrando a ordem minima para o app funcionar:

```text
Passo 1: loginCustomizado → obter session_token + refresh_token
Passo 2: syncConfigMobile → carregar config do servidor (agendamentos, estado)
Passo 3: Iniciar loop de pingMobile (heartbeat a cada 1s)
Passo 4: Quando dentro de janela de monitoramento → reportarStatusMonitoramento + receberAudioMobile
Passo 5: Quando panico → acionarPanicoMobile (localizacao obrigatoria)
```

---

### 2. Nova secao "Fluxos de Uso Completos"

Card grande com sub-secoes colapsaveis para cada fluxo critico:

**Fluxo A — Ciclo de Vida da Sessao (Login ate Logout)**
- Passo a passo: login → armazenar tokens → syncConfig → iniciar heartbeat → refresh antes de expirar → logout
- Mostrar exemplo de payload de cada etapa
- Explicar quando usar refresh_token (antes do access_token expirar)
- Destacar: logout bloqueado se panico ativo (erro PANIC_ACTIVE_CANNOT_LOGOUT)

**Fluxo B — Monitoramento Automatico (Gravacao Agendada)**
- syncConfigMobile retorna `dentro_horario: true` → app inicia gravacao
- reportarStatusGravacao com status "iniciada"
- Loop: gravar 30s → enviar via receberAudioMobile com segmento_idx sequencial
- Ao sair da janela: reportarStatusGravacao com status "finalizada" + motivo_parada
- Tratar grace window: se enviar segmento apos selamento, backend aceita por 60s

**Fluxo C — Panico (Acionamento ate Resolucao)**
- acionarPanicoMobile com localizacao → receber alerta_id + protocolo
- pingMobile automaticamente vincula GPS ao alerta ativo
- enviarLocalizacaoGPS com alerta_id para rastreamento
- Cancelar: cancelarPanicoMobile → respostas variam se < 60s ou > 60s
- Destacar: logout bloqueado durante panico

**Fluxo D — Gerenciamento de Senhas (Normal + Coacao)**
- change_password para alterar senha principal
- change_coercion_password para definir/alterar senha de coacao
- validate_password para validar antes de operacoes sensiveis
- Explicar comportamento anti-coercao: quando logada com senha de coacao, todas alteracoes retornam success mas nao fazem nada

**Fluxo E — Heartbeat e Telemetria GPS**
- pingMobile envia status completo do dispositivo + GPS
- Explicar campos obrigatorios vs opcionais
- Deduplicacao: timestamps repetidos sao ignorados
- Relacao com enviarLocalizacaoGPS: pingMobile ja registra GPS, enviarLocalizacaoGPS e para envios dedicados
- Snap-to-road e auto-follow sao processamento do frontend, nao do backend

---

### 3. Adicionar "Como o App Deve Tratar Erros" 

Nova card com tabela de erros comuns e como o app deve reagir:

| Erro | HTTP | Acao do App |
|------|------|-------------|
| RATE_LIMITED | 429 | Aguardar 15 min, mostrar mensagem |
| SESSION_EXPIRED | 401 | Chamar refresh_token, se falhar → tela de login |
| PANIC_ACTIVE_CANNOT_LOGOUT | 403 | Informar que precisa cancelar panico primeiro |
| DEVICE_MISMATCH | 400 | Reautenticar dispositivo |
| DEVICE_ID_REQUIRED | 400 | Enviar device_id no proximo request |

---

### 4. Enriquecer cada EndpointCard com campo `usageGuide`

Adicionar campo opcional `usageGuide` na interface `Endpoint` — um texto explicativo que aparece dentro do card expandido, antes dos parametros, orientando **quando e como** usar aquela action especifica.

Exemplos:
- **loginCustomizado**: "Primeira chamada do app. Armazene o session_token de forma segura (SharedPreferences/Keychain). O refresh_token deve ser guardado separadamente para renovacao. Se loginTipo retornar 'coacao', o app deve se comportar normalmente sem revelar a deteccao."
- **pingMobile**: "Deve ser chamado continuamente em background via servico nativo (AlarmManager no Android). Envie TODOS os campos disponiveis — bateria, GPS, status de gravacao. O backend usa esses dados para determinar se o dispositivo esta online."
- **receberAudioMobile**: "Envie cada segmento de 30s assim que gravado. Use segmento_idx sequencial (0, 1, 2...) para garantir idempotencia. Se a sessao foi encerrada mas o segmento esta atrasado, o backend aceita por 60s (grace window). Prefira multipart/form-data para upload binario direto."

---

### 5. Atualizar versao para v2.2

---

### Detalhes tecnicos

**Arquivo a modificar:** `src/pages/DocApi.tsx`

**Alteracoes na interface Endpoint:**
- Adicionar campo `usageGuide?: string` 

**Alteracoes no array ENDPOINTS:**
- Adicionar `usageGuide` em todas as 16 actions existentes

**Alteracoes no componente EndpointCard:**
- Renderizar `usageGuide` como bloco destacado (bg azul claro) logo apos a descricao, antes da tabela de parametros

**Novas secoes no componente DocApiPage (apos Connection Info):**
1. Card "Guia de Integracao Rapida" — checklist com 5 passos
2. Card "Fluxos de Uso Completos" com 5 sub-secoes colapsaveis (A-E)
3. Card "Tratamento de Erros" com tabela de erros e acoes

**Ordem final das secoes na pagina:**
1. Titulo + versao
2. Informacoes de Conexao
3. **Guia de Integracao Rapida (NOVO)**
4. **Fluxos de Uso Completos (NOVO)**
5. **Tratamento de Erros (NOVO)**
6. Rate Limiting
7. Deduplicacao GPS & Grace Window
8. Aliases de Actions
9. Arquitetura de Telemetria
10. Analise de IA
11. Anti-coercao
12. Endpoints por Fase (com usageGuide em cada card)
13. Footer v2.2

