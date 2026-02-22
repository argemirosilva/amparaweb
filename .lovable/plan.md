

# Correção: Garantir Sempre Uma Única Sessão Ativa por Usuária

## Problema

Existem dois pontos no backend que criam sessões de monitoramento:
1. `syncConfigMobile` (agendamento automático)
2. `reportarStatusGravacao` com status "iniciada" (gravação manual/panico)

Em ambos, o código verifica se já existe sessão ativa para o mesmo device. Se existir, reutiliza. Mas **nunca encerra sessões anteriores** de outros devices ou sessões órfãs. Resultado: múltiplas sessões "ativa" se acumulam.

Além disso, o `cancelPanico` usa `maybeSingle()` e só sela uma sessão, deixando as demais ativas.

## Solução

Regra única: **antes de criar qualquer sessão nova, selar TODAS as sessões ativas do usuário**. Isso garante no máximo uma sessão ativa por vez.

## Alterações

### 1. mobile-api: syncConfigMobile (linha ~724)

**Antes:** Verifica sessão ativa por `user_id + device_id`. Se não existe, cria nova.

**Depois:** Antes de criar, buscar TODAS as sessões ativas do `user_id` (qualquer device). Selar cada uma com `sealed_reason: "nova_sessao"`. Depois criar a nova.

### 2. mobile-api: reportarStatusGravacao - "iniciada" (linha ~1912)

**Antes:** Verifica sessão ativa por `user_id + device_id`. Se não existe, cria nova.

**Depois:** Mesmo padrão — selar todas as sessões ativas do user antes de criar a nova.

### 3. mobile-api: cancelPanico (linha ~1425)

**Antes:** `maybeSingle()` — sela apenas uma sessão.

**Depois:** Buscar com `.select("id")` sem `maybeSingle()` para obter TODAS as sessões ativas e selar cada uma.

### 4. web-api: cancelPanico

Mesma correção do ponto 3 — selar todas as sessões ativas, não apenas uma.

### 5. mobile-api: receberAudioMobile (linha ~1578)

**Antes:** Retorna erro 400 se não há sessão ativa.

**Depois:** Quando não há sessão ativa, salvar o áudio como gravação independente na tabela `gravacoes` (status "pendente") e disparar `process-recording`. Isso resolve a race condition de segmentos que chegam após o cancelamento.

### 6. session-maintenance: auto-expirar sessões órfãs

Adicionar um Step 0 no `session-maintenance` que busca sessões com status "ativa" há mais de 10 minutos sem nenhum segmento vinculado e as marca como `sem_segmentos` (delete ou seal).

### 7. Limpeza imediata do banco

Executar SQL para selar as 14 sessões ativas órfãs atuais.

---

## Detalhes Técnicos

### Função auxiliar para selar sessões (mobile-api)

Criar uma função reutilizável `sealAllActiveSessions(supabase, userId, reason)` que:
1. Busca todas as sessões com `status = "ativa"` e `user_id = userId`
2. Para cada uma, faz update para `status: "aguardando_finalizacao"`, `closed_at: now`, `sealed_reason: reason`
3. Insere audit_log para cada sessão selada
4. Retorna a quantidade de sessões seladas

Essa função será chamada em: `syncConfigMobile`, `reportarStatusGravacao("iniciada")`, `cancelPanico`.

### Fluxo corrigido de criação de sessão

```text
App solicita nova sessão (sync ou iniciarGravacao)
         |
  sealAllActiveSessions(userId, "nova_sessao")
         |
  Cria sessão nova (status "ativa")
         |
  Apenas 1 sessão ativa por vez
```

### Fluxo corrigido do receberAudio sem sessão

```text
Android envia segmento de áudio
         |
    Sessão ativa?
    /          \
  SIM          NÃO
   |             |
Salva como    Salva no R2 +
segmento      insere em gravacoes
da sessão     (status "pendente") +
              dispara process-recording
```

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/mobile-api/index.ts` | Função `sealAllActiveSessions`; chamada nos 3 pontos; fallback no receberAudio |
| `supabase/functions/web-api/index.ts` | cancelPanico: selar todas as sessões |
| `supabase/functions/session-maintenance/index.ts` | Step 0: auto-expirar sessões ativas sem segmentos > 10 min |

