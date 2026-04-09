

# Plano: Descarte de Segmentos Irrelevantes na Concatenacao

## Resumo

Segmentos `sem_risco` sao excluidos da concatenacao. Gravacoes resultantes que nao tem nenhum segmento relevante sao marcadas como `sem_risco` sem transcricao nem analise visivel. Na interface, gravacoes `sem_risco` mostram apenas o status — sem transcricao, sem card de analise.

## Alteracoes

### 1. Migration — nova coluna `segmentos_descartados`

```sql
ALTER TABLE gravacoes ADD COLUMN segmentos_descartados integer NOT NULL DEFAULT 0;
```

### 2. `session-maintenance/index.ts`

Na etapa de concatenacao (~linha 421):
- Separar segmentos em relevantes (`triage_risco != 'sem_risco'` ou `NULL`) e descartados (`triage_risco = 'sem_risco'`)
- Concatenar apenas relevantes
- Se TODOS forem `sem_risco`: ainda concatenar o audio (para arquivo), mas marcar gravacao com `status = 'sem_risco'`, salvar `segmentos_descartados`, e NAO disparar `process-recording`
- Se ha relevantes: concatenar normalmente, salvar `segmentos_descartados`, disparar `process-recording`

### 3. `process-recording/index.ts`

Adicionar early return no inicio: se gravacao ja tem `status = 'sem_risco'`, retornar sem processar.

### 4. Frontend — `GravacaoExpandedContent.tsx`

- Se `status === 'sem_risco'`: nao mostrar transcricao, nao mostrar AnaliseCard
- Mostrar badge "Sem risco — X segmentos descartados" quando `segmentos_descartados > 0`

### 5. Frontend — `Gravacoes.tsx`

- Badge inline discreto mostrando segmentos descartados quando aplicavel
- Gravacoes `sem_risco` exibem apenas status, sem preview de transcricao

## Arquivos modificados

| Arquivo | Alteracao |
|---------|----------|
| Migration SQL | ADD COLUMN `segmentos_descartados` |
| `session-maintenance/index.ts` | Filtrar segmentos antes de concatenar |
| `process-recording/index.ts` | Early return se sem_risco |
| `GravacaoExpandedContent.tsx` | Ocultar transcricao/analise para sem_risco |
| `Gravacoes.tsx` | Badge de segmentos descartados |

