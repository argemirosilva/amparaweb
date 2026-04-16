

## Plano: Permissões por Entidade + Magistrado com acesso nacional

### Visão geral
Três mudanças principais:
1. **Entidades** ganham configuração de quais telas do menu admin os usuários vinculados podem acessar.
2. **Operadores/Técnicos** vinculados a uma entidade só veem dados (vítimas/agressores/gravações) cuja UF coincide com a UF da entidade.
3. **Novo papel "Magistrado"** com acesso exclusivo à tela `/admin/tribunal`, podendo pesquisar vítimas e agressores em **todo o Brasil**, sem filtro de estado.

---

### 1. Banco de dados (migrations)

**a) Novo papel no enum:**
```sql
ALTER TYPE public.admin_role ADD VALUE IF NOT EXISTS 'magistrado';
```

**b) Nova coluna em `tenants`:**
```sql
ALTER TABLE public.tenants
  ADD COLUMN telas_permitidas jsonb NOT NULL DEFAULT '[]'::jsonb;
-- ex: ["/admin", "/admin/usuarios", "/admin/relatorios", "/admin/tribunal"]
```
Default vazio = todas as telas permitidas (compatibilidade retroativa). Quando preenchido, restringe.

---

### 2. Tela "Entidades" (`AdminOrgaos.tsx`)

Adicionar no formulário de criação/edição uma seção **"Telas Permitidas"** com checkboxes para cada item do menu admin (Dashboard, Usuários, Suporte, Curadoria, Tribunal, Entidades, Auditoria, Relatórios, Configurações, Integrações, Doc API).

Persistir em `tenants.telas_permitidas` via `updateTenant`/`createTenant` no `admin-api`.

---

### 3. Sidebar (`AdminLayout.tsx` + `useAdminRole.ts`)

- `useAdminRole` já busca `tenant_id` da role do usuário. Estender para também trazer `telas_permitidas` da entidade.
- Em `AdminLayout`, adicionar filtro extra: se o usuário tem entidade com `telas_permitidas` não-vazio, intersectar com a lista de itens visíveis.
- **Magistrado**: vê apenas `/admin/tribunal` (regra hardcoded, ignora `telas_permitidas`).

---

### 4. Filtro por UF da entidade

No `useAdminRole`, expor também `tenantUf` (UF da entidade do usuário).

Backend (`admin-api`, ações `listUsuarios` e similares; `web-api` consultas administrativas se houver):
- Se o usuário autenticado tem role com `tenant_id` E não é `super_administrador`/`administrador`/`magistrado`, aplicar filtro `endereco_uf = tenantUf` em vítimas e equivalente em agressores (`primary_city_uf` contém a UF).
- Super Admin, Administrador e Magistrado: **sem filtro de UF** (acesso nacional).

---

### 5. Tribunal: Magistrado nacional

Em `tribunal-api/index.ts`:

- `authenticateRequest`: além de validar sessão, verificar role. Se for `magistrado`, marcar `auth.scope = "nacional"`.
- `handleSearchVitima` e `handleSearchAgressor`: hoje já buscam em todas as tabelas sem filtro de UF, então **mantemos** esse comportamento para magistrado/admin.
- Para operadores comuns que eventualmente acessem o Tribunal: aplicar filtro de UF da entidade. Magistrado pula esse filtro.

---

### 6. Proteção de rota Magistrado

`ProtectedAdminRoute` em `/admin/tribunal` já libera para `isAdministrador || isSuperAdmin || isSuporte`. Estender para incluir `isMagistrado`.

Bloquear magistrado em todas as outras rotas admin (redireciona para `/admin/tribunal`).

---

### 7. UI Usuários (`AdminUsuarios.tsx`)

Adicionar `magistrado` no select de roles (criação e edição) e no `ROLE_LABELS`. Para magistrado, o `tenant_id` é opcional (acesso nacional, mas pode ficar vinculado a um tribunal por organização).

---

### Arquivos modificados
- `supabase/migrations/<novo>.sql` (enum + coluna)
- `supabase/functions/admin-api/index.ts` (telas_permitidas, filtro UF, role magistrado)
- `supabase/functions/tribunal-api/index.ts` (scope nacional para magistrado)
- `supabase/functions/web-api/index.ts` (filtro UF se aplicável em buscas admin)
- `src/hooks/useAdminRole.ts` (expõe `tenantUf`, `telasPermitidas`, `isMagistrado`)
- `src/components/institucional/AdminLayout.tsx` (filtro de itens + magistrado isolado)
- `src/components/institucional/ProtectedAdminRoute.tsx` (libera magistrado em /tribunal, bloqueia em outras)
- `src/pages/admin/AdminOrgaos.tsx` (seção Telas Permitidas)
- `src/pages/admin/AdminUsuarios.tsx` (role Magistrado no select + label)

### Observações
- Compatibilidade: entidades existentes ficam com `telas_permitidas = []`, que será interpretado como "todas as telas permitidas" para não quebrar usuários atuais.
- Magistrado é tratado como papel especial: ignora restrições de entidade e ganha acesso nacional na pesquisa do Tribunal.

