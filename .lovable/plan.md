

# Implementar Segmentos de Audio 30s e Controle de Janelas de Monitoramento

## Resumo

Implementar o fluxo bifurcado completo de recebimento de audio em segmentos de 30 segundos, controle automatico de janelas de monitoramento, e job de concatenacao/limpeza, mantendo 100% de compatibilidade com os apps mobile existentes.

---

## Etapa 1: Migracoes de Banco de Dados

Adicionar colunas faltantes nas tabelas existentes para suportar o fluxo completo:

**monitoramento_sessoes** -- colunas novas:
- `window_start_at` (timestamptz) -- inicio da janela de monitoramento
- `window_end_at` (timestamptz) -- fim da janela de monitoramento
- `sealed_reason` (text, nullable) -- motivo do encerramento (manual, silencio, timeout, panico_cancelado, etc.)
- `closed_at` (timestamptz, nullable) -- quando a sessao foi marcada para finalizacao
- `total_segments` (integer, default 0)
- `total_duration_seconds` (double precision, default 0)
- `final_gravacao_id` (uuid, nullable) -- referencia a gravacao final gerada
- `origem` (text, nullable) -- automatico, botao_panico, etc.

**gravacoes_segmentos** -- coluna nova:
- `received_at` (timestamptz, default now())

**gravacoes** -- coluna nova:
- `monitor_session_id` (uuid, nullable) -- referencia a sessao de monitoramento que originou

Adicionar indice unico em `gravacoes_segmentos(monitor_session_id, segmento_idx)` para idempotencia.

---

## Etapa 2: Atualizar `syncConfigMobile` (mobile-api)

Modificar `handleSyncConfig` para:

1. Quando criar sessao ativa, calcular `window_start_at` e `window_end_at` com base no periodo atual do agendamento e no timezone do cliente.
2. Salvar a `origem` como "automatico" (agendado).
3. Manter resposta identica (sem novos campos na response).

---

## Etapa 3: Atualizar `receberAudioMobile` (mobile-api)

Modificar `handleReceberAudio` para:

1. Ao verificar sessao ativa, tambem filtrar por `device_id` (se fornecido).
2. Implementar idempotencia: antes de inserir, verificar se `(monitor_session_id, segmento_idx)` ja existe. Se sim, retornar sucesso com o `segmento_id` existente.
3. Registrar `audit_logs` com action_type `segment_received`.
4. Manter resposta bifurcada conforme documentacao (segmento_id + monitor_session_id ou gravacao_id).
5. A mensagem para segmentos passa a ser: "Segmento de monitoramento salvo. Sera processado na concatenacao final."

---

## Etapa 4: Atualizar `reportarStatusGravacao` (mobile-api)

Reescrever `handleReportarStatusGravacao` para:

1. Aceitar o novo contrato: `status_gravacao`, `origem_gravacao`, `total_segments`, `motivo_parada` (alem dos campos existentes).
2. Se `status_gravacao="finalizada"` e `origem_gravacao` for "automatico" ou "botao_panico":
   - Buscar sessao ativa do usuario/device.
   - Marcar `status="aguardando_finalizacao"`, `closed_at=now()`, `sealed_reason=motivo_parada`.
   - Registrar audit_log `session_sealed`.
3. Se `origem_gravacao="upload_arquivo"` -- nao envolve janela, ignorar.
4. Manter compatibilidade: se os campos novos nao vierem, funcionar como antes (fallback).

---

## Etapa 5: Atualizar `cancelarPanicoMobile` (mobile-api)

Modificar `handleCancelarPanico` para:

1. Buscar sessao ativa do usuario (qualquer device) com `status="ativa"`.
2. Se existir, marcar `status="aguardando_finalizacao"`, `closed_at=now()`, `sealed_reason="panico_cancelado"`, `origem="botao_panico"`.
3. Registrar audit_log `session_sealed`.
4. Manter response identica.

---

## Etapa 6: Criar Edge Function `session-maintenance`

Nova edge function em `supabase/functions/session-maintenance/index.ts` que:

1. Seleciona sessoes com `status="aguardando_finalizacao"` e `closed_at <= now() - 60s`.
2. Para cada sessao:
   a. Busca segmentos em `gravacoes_segmentos` ordenados por `segmento_idx`.
   b. Se nao houver segmentos: marca `status="sem_segmentos"` e segue.
   c. Baixa cada segmento do R2 e concatena em um unico arquivo (buffer binario simples, sem re-encoding).
   d. Faz upload do arquivo final para R2 com path `{user_id}/{date}/{session_id}.audio`.
   e. Calcula duracao total (soma de `duracao_segundos` ou fallback 30s/segmento).
   f. Insere 1 registro em `gravacoes` com `status="pendente"`, `monitor_session_id`, `origem`.
   g. Atualiza sessao: `status="inserida_no_fluxo"`, `total_segments`, `total_duration_seconds`, `final_gravacao_id`.
   h. Verifica que o arquivo final existe no R2 e a gravacao foi criada.
   i. Remove segmentos originais (registros DB + arquivos R2).
   j. Registra audit_logs: `session_concatenated`, `segments_cleanup_done`.
3. Tambem seleciona sessoes com `status="ativa"` cujo `window_end_at` ja passou -- marca como `aguardando_finalizacao` com `sealed_reason="window_expired"` e `closed_at=now()`.

---

## Etapa 7: Agendar Cron Job

Executar SQL (via insert tool, nao migration) para agendar `session-maintenance` a cada 1 minuto usando `pg_cron` + `pg_net`.

---

## Etapa 8: Configuracao

- Adicionar `[functions.session-maintenance]` com `verify_jwt = false` no `config.toml`.

---

## Etapa 9: Atualizar Testes

Atualizar `mobile-api/index.test.ts` para:
- Ajustar teste de `reportarStatusGravacao` (novo contrato aceita `status_gravacao` em vez de `status`).
- Manter todos os testes existentes funcionando.

---

## Detalhes Tecnicos

### Concatenacao de audio (session-maintenance)
A concatenacao sera feita por append binario simples (sem re-encoding), pois os segmentos ja estao no mesmo formato. Para formatos como OGG/Opus que possuem headers, o append simples pode nao ser perfeito, mas e aceitavel para o pipeline de transcricao que processa o arquivo completo.

### Idempotencia de segmentos
Indice unico `(monitor_session_id, segmento_idx)` garante que re-envios do mesmo segmento nao dupliquem. O handler faz um SELECT antes do INSERT e retorna o existente se encontrado.

### Tolerancia de 60 segundos
O job so processa sessoes onde `closed_at <= now() - interval '60 seconds'`, dando tempo para ultimos segmentos chegarem.

### Seguranca na limpeza
Segmentos so sao removidos apos confirmar: (1) arquivo final existe no R2, (2) registro em `gravacoes` criado. Se qualquer erro ocorrer, os segmentos sao preservados e o erro registrado.

