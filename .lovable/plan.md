

## Plano: Implementar Edge Function `segment-triage` + Migração + Integração mobile-api

### 1. Migração DB — 3 colunas novas em `gravacoes_segmentos`

```sql
ALTER TABLE gravacoes_segmentos
  ADD COLUMN triage_risco text,
  ADD COLUMN triage_transcricao text,
  ADD COLUMN triage_at timestamptz;
```

### 2. Nova Edge Function `segment-triage/index.ts`

Recebe `{ segment_id, user_id, storage_path }` e executa:

1. **Download do áudio** do R2 (reutiliza padrão R2 existente)
2. **Transcrição** via Agreggar API (mesma lógica de `process-recording`)
3. **Keyword Scan** — consulta `palavras_triagem` (ativo=true), cache em memória global com TTL de 5 min. Normaliza texto (lowercase, remove acentos) e busca matches
4. **Se nenhum match** → salva `triage_risco = 'sem_risco'` e `triage_transcricao` no segmento, encerra
5. **Se match** → chama `gemini-2.5-flash-lite` com prompt ultracurto (~50 tokens de sistema) pedindo apenas `{ "nivel_risco": "sem_risco|moderado|alto|critico" }`
6. **Se alto** → fire-and-forget `send-whatsapp` (action: notify_alert, tipo: "alto")
7. **Se critico** → fire-and-forget `send-whatsapp` + `copom-outbound-call`
8. **Salva resultado** nas colunas `triage_risco`, `triage_transcricao`, `triage_at` do segmento

Detalhes:
- Busca localização recente do usuário para contexto do WhatsApp
- Cria alerta em `alertas_panico` tipo "triagem_automatica" para alto/critico (necessário para GPS sharing)
- Respeita `configuracao_alertas.acionamentos` da usuária
- Logs em `audit_logs` (action_type: "segment_triage")
- Config TOML: `verify_jwt = false`

### 3. Alteração em `mobile-api/index.ts` — `handleReceberAudio`

Nos dois pontos onde segmentos são inseridos com sucesso (sessão ativa + late segment):
- Após o insert do segmento, fire-and-forget para `segment-triage`:

```typescript
if (segmento?.id) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/segment-triage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      segment_id: segmento.id,
      user_id: user.id,
      storage_path: storagePath,
    }),
  }).catch((e) => console.error("segment-triage trigger error:", e));
}
```

### 4. Prompt de Triagem (Flash-Lite)

```
Classifique o risco desta fala. Retorne APENAS JSON: {"nivel_risco":"sem_risco|moderado|alto|critico"}
Contexto: transcrição de áudio de monitoramento de violência doméstica.
Palavras detectadas: [lista dos matches]
Transcrição: [texto]
```

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | 3 colunas em `gravacoes_segmentos` |
| `supabase/functions/segment-triage/index.ts` | Nova edge function |
| `supabase/config.toml` | Adiciona `[functions.segment-triage]` |
| `supabase/functions/mobile-api/index.ts` | Fire-and-forget em 2 pontos do `handleReceberAudio` |

