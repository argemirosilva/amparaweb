

## Plano: Controle Hierárquico de Usuários por Entidade (revisado)

### Premissas confirmadas
1. **Magistrado** → acesso nacional sempre (ignora escopo geográfico)
2. **Suporte** → acesso global sempre (ignora escopo)
3. **Admin de Entidade** pode criar operadores restritos a cidades específicas (subdivisão geográfica por usuário)

### Hierarquia

```text
Super Admin / Administrador          → acesso TOTAL (sem filtro)
Suporte                              → acesso GLOBAL (sem filtro)
Magistrado                           → acesso NACIONAL (sem filtro geo)
        │
Entidade (tenant)                    → escopo: nacional | estadual | municipal
   │                                   + telas_permitidas (lista de módulos)
   │
   ├─ Admin da Entidade (admin_tenant) → herda escopo da entidade
   │                                     vê todas telas da entidade
   │
   └─ Operador                         → escopo ⊆ escopo da entidade
                                         telas ⊆ telas da entidade
                                         pode ter cidade específica
```

### Mudanças no banco

**`tenants`** (adicionar):
- `escopo_geografico` text: `'nacional' | 'estadual' | 'municipal'` (default `'municipal'`)
- `acesso_nacional` boolean (default false, true se escopo=nacional)

**`user_roles`** (adicionar):
- `telas_permitidas` jsonb default `'[]'` (subset das telas da entidade)
- `escopo_uf` text (opcional, restringe operador a UF específica dentro da entidade)
- `escopo_cidade` text (opcional, restringe operador a cidade específica)
- Trigger validador: telas/escopo do usuário ⊆ telas/escopo da entidade

### Lógica de filtro geográfico (backend)

Helper `getUserScope(sessionToken)` retorna:
```ts
{ scope: 'nacional'|'estadual'|'municipal', uf?, cidade? }
```

**Regras de bypass (acesso total, sem filtro):**
- role = `super_administrador` ou `administrador`
- role = `suporte`
- role = `magistrado`

**Demais roles** (admin_tenant, operador):
- nacional → sem filtro
- estadual → `WHERE endereco_uf = scope.uf`
- municipal → `WHERE endereco_uf = scope.uf AND endereco_cidade = scope.cidade`

Aplicar em: `campo-api` (buscarVitima, consultarIndicadores), `admin-api` (listagens de vítimas/dashboards), `tribunal-api` (mas magistrado é nacional, então não filtra).

### Mudanças na UI

**`/admin/orgaos`** (criação/edição de Entidade):
- Novo campo "Escopo de dados": Nacional / Estadual / Municipal
- Se Nacional → marca `acesso_nacional=true` automaticamente, esconde UF/cidade
- Se Estadual → exige UF, esconde cidade
- Se Municipal → exige UF + cidade
- Mantém seletor de telas permitidas

**`/admin/usuarios`**:
- Filtro automático: admin_tenant vê apenas usuários da própria entidade
- Ao criar **operador**:
  - Multi-select de telas (restrito às da entidade)
  - Campos opcionais "UF específica" e "Cidade específica" (restritos ao escopo da entidade — ex: entidade estadual RO permite cidade=Porto Velho, Vilhena, etc.)
- Ao criar **admin_tenant**:
  - Apenas vínculo com entidade (herda tudo)
- Magistrado e Suporte: sem campos de escopo

### Backend (admin-api)

Atualizar/criar actions:
- `createUser` / `updateUser`: validar admin_tenant só mexe na própria entidade; telas/escopo do operador ⊆ entidade
- `listUsers`: admin_tenant filtra por `tenant_id`
- `createTenant` / `updateTenant`: aceitar `escopo_geografico` e `acesso_nacional`

### Frontend (hooks/protecao)

**`useAdminRole`**:
- Adicionar `escopoUf`, `escopoCidade`, `escopoGeografico`, `acessoNacional`
- Calcular `telasEfetivas = intersect(tenant.telas, user_role.telas)` para operador
- Para admin_tenant: telasEfetivas = tenant.telas
- Para magistrado/suporte/super: telasEfetivas = todas

**`ProtectedAdminRoute`**:
- Usar `telasEfetivas` em vez de só `telasPermitidas` da entidade

### Aplicação de escopo geográfico

Endpoints alvo (com guard de bypass para super/admin/suporte/magistrado):
- `campo-api: buscarVitima` — filtra `usuarios.endereco_uf/cidade`
- `campo-api: consultarIndicadores` — valida vítima dentro do escopo (404 se fora)
- `admin-api: listagens de vítimas, dashboards` — `WHERE` por escopo

### Diagrama final

```text
┌─────────────────────────────────────────────────────┐
│ super_admin / administrador → acesso total         │
│ suporte → acesso global                            │
│ magistrado → acesso nacional                       │
└─────────────────────────────────────────────────────┘
                        │
              ┌─────────┴──────────┐
              ▼                    ▼
        Entidade Estadual    Entidade Nacional
        (uf=RO)              (acesso_nacional)
              │
        ┌─────┴──────┐
        ▼            ▼
   Admin_Tenant   Operador
   vê RO inteiro  vê RO ou RO+Porto Velho
                  (subdivisão opcional)
```

### Arquivos a alterar

**Migration:**
- 1 migration: colunas em `tenants` + `user_roles` + trigger validador

**Backend:**
- `supabase/functions/admin-api/index.ts` — createUser/updateUser/listUsers/createTenant
- `supabase/functions/campo-api/index.ts` — guard geográfico em buscarVitima/consultarIndicadores
- `supabase/functions/_shared/scope.ts` (novo) — helper `getUserScope` reutilizável

**Frontend:**
- `src/hooks/useAdminRole.ts` — escopo + telasEfetivas
- `src/components/institucional/ProtectedAdminRoute.tsx` — usar telasEfetivas
- `src/pages/admin/AdminOrgaos.tsx` — campo escopo geográfico
- `src/pages/admin/AdminUsuarios.tsx` — filtro por tenant + campos de escopo do operador

