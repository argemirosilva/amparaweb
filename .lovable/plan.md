
## Mostrar Usuários Utilizados por Entidade (ex: 30/50)

### Objetivo
Na tela de Gestão de Entidades, a coluna "Max Usuários" passará a exibir a quantidade de usuários já vinculados versus o limite, no formato **30/50**.

### Alterações

**1. Backend (`supabase/functions/admin-api/index.ts`)**
- Na action `listTenants`, após buscar os tenants, fazer uma query agrupada na tabela `user_roles` contando usuários distintos por `tenant_id`.
- Mesclar a contagem (`usuarios_ativos`) em cada tenant retornado.

**2. Frontend (`src/pages/admin/AdminOrgaos.tsx`)**
- Adicionar o campo `usuarios_ativos` na interface `Tenant`.
- Alterar a coluna "Max Usuários" para exibir `{t.usuarios_ativos ?? 0}/{t.max_usuarios}`.
- Adicionar uma indicação visual (cor vermelha) caso o uso esteja no limite ou acima.

### Detalhes Técnicos

**Backend - Query de contagem:**
```sql
SELECT tenant_id, COUNT(DISTINCT user_id) as total
FROM user_roles
WHERE tenant_id IS NOT NULL
GROUP BY tenant_id
```

**Frontend - Exibição:**
- Formato: `12/50` (verde/normal) ou `50/50` (vermelho, indicando limite atingido)
