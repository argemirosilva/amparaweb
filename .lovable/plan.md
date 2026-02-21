

# Simplificar Fluxo de Suporte -- Remover Codigo de Consentimento

## Resumo

Remover o fluxo de codigo de 6 digitos. O agente continua precisando **solicitar acesso** a cada gravacao/transcricao/log individualmente (com justificativa), mas o acesso e concedido **automaticamente** ao solicitar -- sem necessidade de codigo. A usuaria ainda pode **revogar** o acesso a qualquer momento e toda atividade continua sendo registrada na auditoria.

## O que muda

| Antes | Depois |
|-------|--------|
| Agente solicita acesso -> gera codigo 6 digitos | Agente solicita acesso -> grant criado automaticamente |
| Usuaria precisa abrir app, ver codigo, informar ao agente | Usuaria ve notificacao de acesso no chat e pode revogar |
| 3 tentativas de codigo, bloqueio, expiracao 2min | Removido completamente |
| Status `waiting_consent` na sessao | Removido -- sessao fica `active` |

## O que permanece igual

- Solicitacao de acesso com justificativa obrigatoria (auditoria)
- Grant temporario de 10 minutos
- Revogacao instantanea pela usuaria ou agente
- Registro completo na `support_audit_timeline` e `support_data_access_log`
- Chat de mensagens diretas
- ResourceViewerModal para visualizar dados

## Detalhes Tecnicos

### 1. Edge Function `support-api/index.ts`

**Action `requestAccess` (linhas 287-341):**
- Remover geracao de codigo (`generateCode6`, `hashCode`)
- Remover `code_hash`, `code_expires_at` do insert na `support_access_requests`
- Apos criar o request, criar imediatamente o `support_access_grant` (10 min)
- Atualizar status do request para `"granted"` direto
- Manter timeline e mensagem de sistema
- Remover `code` do retorno, retornar `grant` direto
- Mudar status da sessao para `"active"` (nao mais `"waiting_consent"`)

**Remover actions completas:**
- `confirmAccess` (linhas 343-417) -- nao precisa mais confirmar codigo
- `showCode` (linhas 860-906) -- nao existe mais codigo
- `denyAccess` (linhas 909-944) -- substituido por `revokeAccess` que ja existe

**Manter sem alteracao:**
- `revokeAccess`, `revokeAllAccess`, `getResource`, `listUserResources`
- `sendMessage`, `sendUserMessage`, `getSession`, `getMySession`
- `myTickets`, `createUserSession`, `getAuditTimeline`, `getPendingConsent`
- `closeSession`, `createSession`, `assignAgent`, `listSessions`
- `listMessages`, `listAccessRequests`, `initiatePasswordReset`

### 2. Painel Admin -- `src/pages/suporte/SuporteChat.tsx`

- No `handleRequestAccess`: apos a resposta, ja usar o grant retornado diretamente (nao exibir codigo)
- Remover modal "Inserir Codigo de Consentimento" (`showConfirm`, `confirmCode`, `confirmRequestId`)
- Remover secao "Aguardando codigo de consentimento" dos pending requests
- Toast de sucesso: "Acesso concedido por 10 minutos" em vez de exibir codigo

### 3. App Usuaria -- `src/pages/support/SupportTicketDetail.tsx`

- Remover secao de pending requests com codigo (`handleShowCode`, `handleConfirmAccess`, `handleDenyAccess`)
- Remover states `codeData`, `confirmCode`, `confirming`
- Remover componente `CodeExpiryTimer`
- Manter secao de grants ativos (com botao "Encerrar acesso agora")
- Manter aba de auditoria

### 4. Nao requer alteracao

- `ResourceViewerModal` -- funciona igual
- Tabelas do banco -- nao precisa alterar schema (campos code_hash ficam nullable, sem problema)
- `SupportHome`, `SupportNew`, `SupportAudit` -- sem mudancas

### Arquivos afetados

- `supabase/functions/support-api/index.ts` -- simplificar `requestAccess`, remover `confirmAccess`, `showCode`, `denyAccess`
- `src/pages/suporte/SuporteChat.tsx` -- remover modal de codigo e secao pending
- `src/pages/support/SupportTicketDetail.tsx` -- remover fluxo de codigo da usuaria

