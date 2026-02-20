

# Modulo de Suporte Tecnico Seguro -- AMPARA

## Visao Geral

Construir um sistema completo de suporte tecnico com controle de acesso granular, consentimento explicito da usuaria, auditoria total e conformidade LGPD. O modulo sera implementado em uma nova pasta `/suporte` dentro da area administrativa, com uma Edge Function dedicada (`support-api`) e 7 novas tabelas no banco de dados.

---

## Fase 1 -- Banco de Dados (Migracao SQL)

Criar as 7 tabelas descritas no prompt, todas com RLS restritivo (acesso apenas via service_role na Edge Function):

### Tabelas

1. **support_sessions** -- sessoes de atendimento com status, categoria, nivel de sensibilidade
2. **support_messages** -- chat entre agente, usuaria e sistema
3. **support_access_requests** -- pedidos formais de acesso a recursos sensiveis (code_hash, tentativas, expiracao)
4. **support_access_grants** -- concessoes efetivas com expiracao de 10 min e revogacao instantanea
5. **support_data_access_log** -- log de cada acesso a dado sensivel (IP, device, grant_id)
6. **support_audit_timeline** -- timeline imutavel visivel pela usuaria (transparencia LGPD)
7. **support_agent_reauth_log** -- log de reautenticacao do agente antes de acessar dados sensiveis

Todas as tabelas terao:
- RLS habilitado com politica restritiva (`false` para acesso direto) -- acesso apenas via Edge Function com service_role
- Indices nos campos mais consultados (user_id, session_id, status, created_at)
- Colunas `resource_type` e `resource_id` referenciam tabelas existentes (gravacoes, gravacoes_analises, etc.) sem duplicar dados

### Enums

- `support_session_status`: open, waiting_user, waiting_consent, active, closed
- `support_category`: app_issue, playback, upload, gps, notifications, account, recording_question, transcription_question, analysis_question, other
- `support_sender_type`: user, agent, system
- `support_resource_type`: recording, transcription, analysis, metadata, logs
- `support_access_scope`: read_metadata, read_transcription, read_audio_stream, read_analysis, read_logs
- `support_access_status`: pending, granted, denied, expired, blocked
- `support_revoked_by`: system, user, agent
- `support_audit_event`: session_created, agent_assigned, access_requested, code_shown, access_granted, data_accessed, access_revoked, access_expired, session_closed, password_reset_initiated

---

## Fase 2 -- Edge Function (`support-api`)

Nova Edge Function `supabase/functions/support-api/index.ts` com as seguintes actions:

### Actions do Agente (requer role admin)
- **listSessions** -- listar tickets com filtros (status, categoria, agente)
- **getSession** -- detalhes de uma sessao + mensagens
- **createSession** -- criar sessao vinculada a uma usuaria
- **sendMessage** -- enviar mensagem (sender_type=agent)
- **assignAgent** -- atribuir agente a sessao
- **closeSession** -- fechar sessao (revoga todos os grants ativos)
- **requestAccess** -- solicitar acesso a recurso especifico (gera codigo 6 digitos, salva hash, expira em 2 min)
- **confirmAccess** -- validar codigo da usuaria (hash + expiracao + tentativas + sessao)
- **revokeAccess** -- revogar grant ativo
- **getResource** -- acessar dado sensivel (SOMENTE se grant ativo e valido; gera log)
- **initiatePasswordReset** -- disparar reset de senha via canal verificado

### Actions da Usuaria (requer sessao de usuario comum)
- **myTickets** -- listar meus tickets
- **sendUserMessage** -- enviar mensagem no chat
- **getAuditTimeline** -- ver timeline de auditoria (transparencia)
- **getPendingConsent** -- ver pedidos de acesso pendentes
- **revokeAllAccess** -- revogar todos os grants ativos de uma sessao

### Logica de Seguranca na Edge Function
- Toda action que entrega dado sensivel verifica: grant ativo + nao expirado + nao revogado
- Codigo de consentimento: 6 digitos, SHA-256, expira em 2 min, max 3 tentativas -> blocked
- Streaming de audio: gera URL assinada temporaria (60s) via proxy existente, nunca download direto
- Cada acesso gera entrada em `support_data_access_log` e `support_audit_timeline`
- Fechamento de sessao revoga automaticamente todos os grants

---

## Fase 3 -- Frontend Admin (Painel do Agente)

Novos arquivos em `src/pages/suporte/`:

### Paginas

1. **SuporteTickets.tsx** -- lista de tickets com filtros por status/categoria, busca, paginacao
2. **SuporteChat.tsx** -- tela de atendimento com:
   - Chat em tempo real (mensagens user/agent/system)
   - Painel lateral com info da sessao e dados basicos da usuaria (sem dados sensiveis)
   - Botao "Solicitar Acesso" com formulario de justificativa e selecao de recurso/escopo
   - Indicador de grant ativo com countdown do tempo restante
   - Botao "Revogar Acesso"
   - Banner "Modo Observador" quando grant ativo
3. **SuporteAuditoria.tsx** -- logs de acesso e timeline para revisao administrativa

### Componentes em `src/components/suporte/`

- **TicketCard.tsx** -- card de ticket com status badge, categoria, data
- **ChatBubble.tsx** -- mensagem no chat (user/agent/system com estilos distintos)
- **AccessRequestForm.tsx** -- modal de solicitacao de acesso (recurso, escopo, justificativa)
- **GrantTimer.tsx** -- countdown visual do grant ativo
- **ConsentCodeDisplay.tsx** -- componente que mostra o codigo para a usuaria (lado usuario)

### Integracao no AdminLayout

- Adicionar item "Suporte" no menu lateral do admin com icone `Headset`
- Rota: `/admin/suporte` (lista) e `/admin/suporte/:sessionId` (chat)

---

## Fase 4 -- Frontend Usuaria (Lado App)

### Pagina `src/pages/MeuSuporte.tsx`

- Lista de tickets abertos/fechados
- Chat com o agente
- Banner "Suporte esta visualizando [recurso] agora" quando grant ativo
- Codigo de consentimento exibido quando solicitado (6 digitos, countdown de 2 min)
- Botao "Encerrar acesso agora" (revogacao instantanea)
- Timeline de auditoria (tudo que o suporte fez, com descricoes amigaveis)

### Integracao

- Adicionar rota `/meu-suporte` dentro do AppLayout
- Botao flutuante ou link em Configuracoes para abrir suporte

---

## Fase 5 -- Configuracao e Deploy

- Adicionar `[functions.support-api]` com `verify_jwt = false` no `supabase/config.toml`
- Service para chamadas: `src/services/supportApiService.ts`
- Deploy da Edge Function

---

## Detalhes Tecnicos

### Fluxo de Consentimento

```text
Agente clica "Solicitar Acesso"
    |
    v
Backend gera codigo 6 digitos
Salva hash SHA-256 + expires_at (2 min) em support_access_requests
Status = pending
    |
    v
Usuaria ve codigo no app (ConsentCodeDisplay)
Evento na timeline: code_shown
    |
    v
Usuaria informa codigo no chat
Backend valida: hash match + nao expirado + tentativas < 3
    |
    +-- FALHA: incrementa tentativas. Se >= 3 -> status = blocked
    |
    +-- SUCESSO: cria grant (10 min), status = granted
        Evento na timeline: access_granted
```

### Seguranca do Streaming de Audio

- Reutiliza a logica existente de `proxyAudio` no `web-api`
- A `support-api` valida grant ativo antes de gerar URL assinada
- URL expira em 60 segundos
- Cada play gera log em `support_data_access_log`

### Estrutura de Arquivos

```text
src/pages/suporte/
  SuporteTickets.tsx
  SuporteChat.tsx
  SuporteAuditoria.tsx

src/pages/MeuSuporte.tsx

src/components/suporte/
  TicketCard.tsx
  ChatBubble.tsx
  AccessRequestForm.tsx
  GrantTimer.tsx
  ConsentCodeDisplay.tsx

src/services/supportApiService.ts

supabase/functions/support-api/index.ts
```

### Estimativa de Complexidade

Este e um modulo grande. A implementacao sera feita de forma incremental:
1. Migracao de banco (todas as tabelas de uma vez)
2. Edge Function com actions basicas (CRUD de sessoes + mensagens)
3. Frontend admin (lista + chat)
4. Logica de consentimento (request/confirm/revoke)
5. Frontend usuaria (meu suporte + consentimento)
6. Auditoria e timeline

