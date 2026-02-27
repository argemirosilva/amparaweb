

## Problema

O app mobile chama `syncConfigMobile` a cada ping. Quando o horario atual esta dentro de um periodo agendado, o backend cria automaticamente uma sessao de monitoramento -- **sem verificar se ha um panico ativo**. Resultado: panico e monitoramento coexistem, o que nao deveria acontecer.

Alem disso, `handleAcionarPanico` nao sela sessoes de monitoramento ativas ao criar o alerta (so sela no cancelamento).

## Correcoes

### 1. Backend: Nao criar sessao de monitoramento durante panico ativo

No arquivo `supabase/functions/mobile-api/index.ts`, na logica do `syncConfigMobile` (linha ~778), antes de criar uma nova sessao de monitoramento, verificar se existe um alerta de panico ativo para a usuaria. Se sim, pular a criacao da sessao.

```text
Fluxo atual:
  sync -> dentro do horario? -> existe sessao ativa? -> NAO -> cria sessao

Fluxo corrigido:
  sync -> dentro do horario? -> panico ativo? -> SIM -> pula criacao
                                              -> NAO -> existe sessao? -> cria sessao
```

### 2. Backend: Selar sessoes ativas ao acionar panico

No mesmo arquivo, na funcao `handleAcionarPanico` (linha ~1408), adicionar chamada a `sealAllActiveSessions` e resetar flags do `device_status` logo apos criar o alerta. Isso garante que ao acionar panico, qualquer monitoramento em andamento e encerrado.

### 3. Frontend: Ocultar indicador de monitoramento durante panico

No arquivo `src/components/dashboard/DeviceStatusCard.tsx`, alterar a condicao do indicador de gravacao/monitoramento (linha ~179) para nao exibir quando `panicActive` e verdadeiro. O banner de panico ja comunica a situacao de emergencia.

### 4. Correcao imediata no banco

Selar a sessao de monitoramento ativa atual (id `71a29a0d-...`) e resetar os flags no `device_status` da usuaria.

---

### Secao Tecnica

**Arquivos modificados:**
- `supabase/functions/mobile-api/index.ts` — Duas alteracoes:
  1. Em `syncConfigMobile` (~linha 778): consultar `alertas_panico` com `status = 'ativo'` antes de criar sessao. Se existir, nao criar.
  2. Em `handleAcionarPanico` (~linha 1408): adicionar `sealAllActiveSessions(supabase, user.id, "panico_acionado", ip)` + reset de `device_status`
- `src/components/dashboard/DeviceStatusCard.tsx` — Linha 179: condicao `(device?.is_recording || device?.is_monitoring) && !panicActive`
- Migracao SQL para selar sessao orfã e resetar flags
