

# AMPARA Mobile API v2.0 - Fase 1

## Resumo

Criar uma Edge Function unica `mobile-api` que atua como endpoint action-based (`POST /mobile-api`), roteando por campo `action` no body JSON. Fase 1 implementa completamente 4 actions e cria stubs 501 para as demais.

## Novas Tabelas Necessarias (Migracao SQL)

O banco atual so possui `usuarios`, `user_sessions`, `audit_logs` e `rate_limit_attempts`. Para a API mobile sao necessarias tabelas adicionais:

### Tabelas para Fase 1

1. **refresh_tokens** - tokens de refresh com rotacao
   - `id` uuid PK
   - `user_id` uuid FK -> usuarios
   - `token_hash` text NOT NULL UNIQUE
   - `expires_at` timestamptz NOT NULL
   - `revoked_at` timestamptz NULL
   - `replaced_by` uuid NULL (FK self-ref para rotacao)
   - `ip_address` text NULL
   - `created_at` timestamptz DEFAULT now()

2. **device_status** - estado de cada dispositivo (ping, bateria, versao)
   - `id` uuid PK
   - `user_id` uuid FK -> usuarios
   - `device_id` text NOT NULL
   - `last_ping_at` timestamptz
   - `status` text DEFAULT 'offline' (online/offline/stale)
   - `bateria_percentual` int NULL
   - `is_charging` boolean NULL
   - `dispositivo_info` text NULL
   - `versao_app` text NULL
   - `is_recording` boolean DEFAULT false
   - `is_monitoring` boolean DEFAULT false
   - `timezone` text NULL
   - `timezone_offset_minutes` int NULL
   - `created_at` timestamptz DEFAULT now()
   - `updated_at` timestamptz DEFAULT now()
   - UNIQUE(user_id, device_id)

3. **monitoramento_sessoes** - sessoes de monitoramento agendado
   - `id` uuid PK
   - `user_id` uuid FK -> usuarios
   - `device_id` text NULL
   - `status` text DEFAULT 'ativa' (ativa/finalizada/cancelada)
   - `iniciado_em` timestamptz DEFAULT now()
   - `finalizado_em` timestamptz NULL
   - `created_at` timestamptz DEFAULT now()

4. **agendamentos_monitoramento** - periodos semanais de monitoramento
   - `id` uuid PK
   - `user_id` uuid FK -> usuarios UNIQUE
   - `periodos_semana` jsonb NOT NULL DEFAULT '{}'
   - `updated_at` timestamptz DEFAULT now()

5. Adicionar coluna `tipo_interesse` (text, nullable) em `usuarios` (campo retornado pelo login mobile).

### Tabelas para Fase 2 (stubs por enquanto)

- `alertas_panico`, `localizacoes`, `gravacoes`, `gravacoes_segmentos` - serao criadas quando as actions forem implementadas.

## Edge Function: `mobile-api`

Um unico arquivo `supabase/functions/mobile-api/index.ts` com:

### Estrutura do Roteador

```text
POST /mobile-api
  -> parse JSON body
  -> extrair "action"
  -> switch(action)
      loginCustomizado    -> handleLogin()
      refresh_token       -> handleRefreshToken()
      pingMobile          -> handlePing()
      syncConfigMobile    -> handleSyncConfig()
      logoutMobile        -> stub 501
      validate_password   -> stub 501
      change_password     -> stub 501
      update_schedules    -> stub 501
      enviarLocalizacaoGPS -> stub 501
      acionarPanicoMobile -> stub 501
      cancelarPanicoMobile -> stub 501
      receberAudioMobile  -> stub 501
      getAudioSignedUrl   -> stub 501
      reprocessarGravacao -> stub 501
      reprocess_recording -> stub 501
      reportarStatusMonitoramento -> stub 501
      reportarStatusGravacao      -> stub 501
      default -> 400 "Action desconhecida"
```

### Detalhes de Implementacao - Fase 1

#### loginCustomizado
- Rate limit 5/15min por email+ip (tabela `rate_limit_attempts`)
- Buscar usuario por email em `usuarios`
- Comparar `senha` com `senha_hash` (bcrypt) e `senha_coacao_hash`
- Se coacao: `loginTipo="coacao"`, registrar evento silencioso em `audit_logs`
- Se `tipo_acao="desinstalacao"`: registrar em `audit_logs`
- Gerar `access_token` (64 bytes hex, 24h) salvo como hash em `user_sessions`
- Gerar `refresh_token` (128 chars hex, 30 dias) salvo como hash em `refresh_tokens`
- Retornar usuario com campos: id, email, nome_completo, telefone, tipo_interesse
- Response inclui `session.token` e `session.expires_at`

#### refresh_token
- Receber refresh_token (128 chars)
- Buscar em `refresh_tokens` por hash, nao revogado, nao expirado
- Revogar o token atual (`revoked_at = now()`)
- Gerar novo par access_token + refresh_token
- Salvar novo refresh com `replaced_by` apontando para o anterior
- Criar nova sessao em `user_sessions`
- Retornar `{ success, access_token, refresh_token, user }`

#### pingMobile
- Validar session_token (buscar em user_sessions por hash)
- Sessao expirada ou revogada: 401
- Upsert em `device_status` com dados recebidos (bateria, charging, versao, etc.)
- Atualizar `last_ping_at`, `status='online'`
- Retornar `{ success: true, status: "online", servidor_timestamp }`

#### syncConfigMobile
- Buscar usuario por email
- Buscar agendamentos em `agendamentos_monitoramento`
- Se `device_id` fornecido e horario atual dentro de periodo agendado: criar sessao em `monitoramento_sessoes` com status='ativa'
- Usar timezone/offset do cliente para calculo de horario
- Retornar configuracoes do usuario

### Funcoes Utilitarias (dentro do mesmo arquivo)

- `generateToken(length)` - gera token hex
- `hashToken(token)` - SHA-256 do token
- `checkRateLimit(supabase, identifier, action, limit, windowMinutes)` - consulta rate_limit_attempts
- `validateSession(supabase, session_token)` - valida sessao e retorna user
- `jsonResponse(data, status, corsHeaders)` - helper de resposta

## Configuracao

Adicionar em `supabase/config.toml`:

```toml
[functions.mobile-api]
verify_jwt = false
```

## Testes

Criar `supabase/functions/mobile-api/index.test.ts` com testes de contrato usando `Deno.test()`:

1. **loginCustomizado** - sucesso com credenciais validas, erro com senha errada, rate limit apos 5 tentativas
2. **refresh_token** - rotacao gera novo par, token invalido retorna 401
3. **pingMobile** - sucesso com sessao valida, 401 com sessao expirada
4. **syncConfigMobile** - retorno de config, criacao de sessao quando dentro da janela

## Exemplos curl para Teste Manual

```text
# loginCustomizado
curl -X POST https://uogenwcycqykfsuongrl.supabase.co/functions/v1/mobile-api \
  -H "Content-Type: application/json" \
  -H "apikey: <ANON_KEY>" \
  -d '{"action":"loginCustomizado","email":"user@test.com","senha":"123456"}'

# refresh_token
curl -X POST .../mobile-api \
  -d '{"action":"refresh_token","refresh_token":"<128_char_token>"}'

# pingMobile
curl -X POST .../mobile-api \
  -d '{"action":"pingMobile","session_token":"<token>","device_id":"abc123"}'

# syncConfigMobile
curl -X POST .../mobile-api \
  -d '{"action":"syncConfigMobile","email_usuario":"user@test.com","device_id":"abc123"}'

# Stub (retorna 501)
curl -X POST .../mobile-api \
  -d '{"action":"logoutMobile"}'
```

## Arquivos Criados/Alterados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/mobile-api/index.ts` | Criar - endpoint principal com roteador e 4 actions implementadas + stubs |
| `supabase/functions/mobile-api/index.test.ts` | Criar - testes de contrato |
| `supabase/config.toml` | Alterar - adicionar `[functions.mobile-api] verify_jwt = false` |
| Migracao SQL | Criar tabelas refresh_tokens, device_status, monitoramento_sessoes, agendamentos_monitoramento + coluna tipo_interesse |

## Sequencia de Execucao

1. Executar migracao SQL (novas tabelas + coluna)
2. Criar o arquivo da edge function `mobile-api/index.ts`
3. Atualizar `config.toml`
4. Deploy da function
5. Criar e rodar testes
6. Validar com curl

