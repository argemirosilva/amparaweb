

## Plano: Acesso direto Web via App (SSO transparente)

Implementação **incremental** sobre o fluxo atual de sessões (`user_sessions` + `localStorage`), sem tocar no login tradicional.

### Visão geral do fluxo

```text
App mobile (logada)
   │  toca "Acessar Portal Web"
   ▼
mobile-api: action "issueWebSsoToken"
   │  cria token SSO (one-time, TTL 60s)
   ▼
App abre URL: https://amparamulher.com.br/sso?t=<token>
   ▼
Portal /sso (SSOEntryPage)
   │  loading neutro, lê t da URL
   ▼
POST web-api: action "consumeWebSsoToken"
   │  valida assinatura, expiração, uso único, device, usuária ativa
   │  marca token usado, cria user_sessions origin='web_sso'
   ▼
Portal grava session_token no localStorage (mesmo padrão atual)
   │  history.replaceState para limpar a URL
   ▼
Redireciona para /home autenticado
```

Falha em qualquer ponto → redirect silencioso para `/login` (sem mensagem técnica).

### Banco de dados (1 migration)

Nova tabela `web_sso_tokens`:
```text
id uuid pk
token_hash text not null unique     -- SHA-256 do token bruto
user_id uuid not null fk usuarios
mobile_session_id uuid fk user_sessions  -- sessão app que emitiu
device_id text                       -- vincula ao device do app
issued_ip text
issued_user_agent text
expires_at timestamptz not null      -- now() + 60s
consumed_at timestamptz              -- preenchido no 1o uso
consumed_ip text
consumed_user_agent text
revoked_at timestamptz
created_at timestamptz default now()
```
- Índice em `token_hash`, `user_id`, `expires_at`.
- RLS: nenhuma policy (acesso só via service_role nas edge functions).
- Coluna em `user_sessions.origin` aceita `'web_sso'` (já é text livre).

### Backend - emissão (mobile-api)

Nova action `issueWebSsoToken` em `supabase/functions/mobile-api/index.ts`:
- Exige `session_token` mobile válido (via `validateMobileSession` existente).
- Gera token aleatório 64 bytes hex, hash SHA-256.
- Insere `web_sso_tokens` com `expires_at = now() + 60s`, vincula `user_id`, `mobile_session_id`, `device_id`.
- Resposta: `{ sso_token, expires_at, portal_url }` onde `portal_url = https://<host>/sso?t=<token>`.
- Audit log: `web_sso_token_issued`.

### Backend - consumo (web-api)

Nova action `consumeWebSsoToken` em `supabase/functions/web-api/index.ts` (não exige session_token; recebe só o `sso_token`):

Validações em ordem:
1. Token presente e formato válido → senão 401 genérico.
2. Hash existe em `web_sso_tokens` → senão 401.
3. `consumed_at IS NULL` → senão 401 (uso único).
4. `revoked_at IS NULL` → senão 401.
5. `expires_at > now()` → senão 401.
6. Usuária `ativo = true` e `email_verificado = true` → senão 401.
7. (Opcional, futuro) `mobile_session_id` ainda válida e não revogada.

Em sucesso, transação:
- `UPDATE web_sso_tokens SET consumed_at = now(), consumed_ip, consumed_user_agent WHERE id = ?`
- `INSERT user_sessions (user_id, token_hash, expires_at = now()+24h, origin = 'web_sso', ip, user_agent)` gerando novo `web_session_token`.
- Audit log: `web_sso_consumed_success`.

Resposta: `{ success: true, session: { token, expires_at }, usuario: {...} }` (mesmo shape de `auth-login`).

Falhas:
- Sempre status 401 com `{ success: false }` genérico (sem revelar motivo).
- Audit log interno com motivo real (`expired`, `already_consumed`, `not_found`, `user_inactive`).

Rate limit: usar `rate_limit_attempts` existente com `action_type = 'sso_consume'`, chave por IP, máx 10/min. Retorna 401 genérico ao estourar (não 429, pra não vazar info).

### Frontend - rota /sso

Novo arquivo `src/pages/SSOEntry.tsx`:
- UI mínima: fundo branco, logo Ampara pequeno centralizado, spinner discreto. **Sem texto** ou no máximo "Carregando…".
- Hook `useEffect` no mount:
  1. Lê `t` de `window.location.search`.
  2. `history.replaceState(null, '', '/sso')` imediatamente para tirar token da URL.
  3. Se ausente → `navigate('/login', { replace: true })`.
  4. POST para `web-api` action `consumeWebSsoToken` com `{ sso_token: t }` (sem session header).
  5. Se sucesso: grava `ampara_session_token` no localStorage, chama `checkSession()` do AuthContext (ou faz reload em `/home`), navega para `/home`.
  6. Se falha: `navigate('/login', { replace: true })`.
- Token nunca persistido em state, localStorage, sessionStorage. Variável local descartada após chamada.

Registro em `src/App.tsx`: `<Route path="/sso" element={<SSOEntry />} />` (rota pública, fora do AppLayout, antes do catch-all).

### AuthContext - integração mínima

Em `src/contexts/AuthContext.tsx` expor método `setSessionFromToken(token: string)`:
- Salva no localStorage, chama `checkSession()` para hidratar `usuario`.
- Usado pelo `SSOEntry` para evitar reload da página.

Nenhuma outra mudança no contexto. Login tradicional intacto.

### Service helper

`src/services/webApiService.ts` ganha função `consumeSsoToken(token: string)` que faz fetch direto sem `session_token` no body, retorna `{ ok, data }`.

### Estrutura para sensibilidade por tela (preparação)

Novo helper `src/lib/routeSensitivity.ts`:
```ts
export type Sensitivity = 'low' | 'medium' | 'high';
export const ROUTE_SENSITIVITY: Record<string, Sensitivity> = {
  '/home': 'low', '/mapa': 'low', '/gravacoes': 'low',
  '/perfil': 'medium', '/fonar': 'medium', '/busca-perfil': 'medium',
  '/configuracoes': 'high',
};
export function getSensitivity(path: string): Sensitivity { ... }
export function requiresStepUp(path: string, session: { origin: string, last_step_up_at?: string }): boolean { ... }
```

Hoje retorna sempre `false` (placeholder). No futuro, `requiresStepUp` pode bloquear rotas `high` quando `session.origin === 'web_sso'` e exigir PIN/biometria.

Coluna futura sugerida em `user_sessions`: `last_step_up_at timestamptz` (não criada agora, fica no roadmap).

### Higiene e privacidade

- Token NUNCA em logs do console no frontend.
- `history.replaceState` antes da chamada de rede para evitar token em referer.
- Resposta de erro do consumo é genérica (mesmo corpo, mesmo status) para não permitir oráculo.
- Audit logs internos detalhados em `audit_logs` com `action_type` específico (`web_sso_token_issued`, `web_sso_consumed_success`, `web_sso_consumed_failed` + reason em `details`).

### Compatibilidade

- `auth-login` intacto.
- `auth-session` intacto (vai validar tokens com origin `web_sso` igual aos `web`).
- `AuthContext` ganha 1 método novo, sem mudar comportamento existente.
- Rota `/login` continua sendo o fallback universal.

### Roadmap futuro (não implementar agora, só deixar a estrutura pronta)

- Cookies httpOnly substituindo localStorage (exige mudanças amplas no AuthContext, fora do escopo).
- Step-up auth via PIN/biometria nas rotas `high`.
- Revogação cross-device: ao sair do app, revogar `web_sso` sessions do mesmo `device_id`.
- Botão "Acessar Portal Web" no app mobile (a ser adicionado quando o app nativo for construído).

### Arquivos a criar/alterar

**Criar:**
- `supabase/migrations/<timestamp>_web_sso_tokens.sql`
- `src/pages/SSOEntry.tsx`
- `src/lib/routeSensitivity.ts`

**Editar:**
- `supabase/functions/mobile-api/index.ts` (action `issueWebSsoToken`)
- `supabase/functions/web-api/index.ts` (action `consumeWebSsoToken`)
- `src/services/webApiService.ts` (helper `consumeSsoToken`)
- `src/contexts/AuthContext.tsx` (método `setSessionFromToken`)
- `src/App.tsx` (rota `/sso`)

