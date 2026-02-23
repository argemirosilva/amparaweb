

## Limpeza automática de localizações antigas

### Objetivo
Adicionar uma rotina de limpeza na tabela `localizacoes`, removendo registros com mais de 1 dia de antiguidade. A limpeza será integrada ao fluxo existente do `cleanup-recordings`, que já roda diariamente às 03:00 via cron job.

### Abordagem
Aproveitar a edge function `cleanup-recordings` que já possui um cron job configurado (diário às 03h). Basta adicionar um bloco de limpeza da tabela `localizacoes` no mesmo fluxo, antes ou depois da limpeza de gravações.

### Alterações

**1. `supabase/functions/cleanup-recordings/index.ts`**

Adicionar um novo bloco dentro do `try` principal que:
- Calcula o cutoff de 24 horas (`now() - 1 dia`)
- Deleta todos os registros da tabela `localizacoes` com `created_at` anterior ao cutoff
- Registra a quantidade deletada no log e no audit_log
- Inclui o resultado no response final

### Detalhes técnicos

```text
Fluxo atualizado do cleanup-recordings:

  [Cron 03:00 UTC]
       |
       v
  cleanup-recordings
       |
       +---> Limpeza localizacoes (created_at < now - 1 dia)
       |
       +---> Limpeza gravacoes sem_risco (existente)
       |
       v
  audit_log + response
```

A query de delete usará o Supabase client:
- `supabase.from("localizacoes").delete().lt("created_at", cutoff24h)`
- Como o Supabase JS não retorna count em deletes facilmente, faremos um SELECT count antes para registrar no log

Nenhuma nova edge function, cron job ou migração necessária -- tudo se encaixa na infraestrutura existente.
