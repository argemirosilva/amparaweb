

## Plano: Avaliação de Atendimento + Relatório de Suporte

### Visão Geral
Três entregas: (1) avaliação pós-atendimento pela usuária, (2) nova aba "Suporte" em Admin Relatórios com gráficos de avaliações, (3) ranking Top 10 agentes.

---

### 1. Tabela `support_ratings` (migração)

```sql
CREATE TABLE public.support_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  agent_id uuid,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block direct access support_ratings" ON public.support_ratings FOR ALL USING (false) WITH CHECK (false);
CREATE UNIQUE INDEX idx_support_ratings_session ON public.support_ratings(session_id);
```

Uma avaliação por sessão (1-5 estrelas + comentário opcional).

---

### 2. Backend: `support-api` — duas novas actions

**`rateSession`** (user action):
- Recebe `session_id`, `rating` (1-5), `comment` (opcional)
- Valida: sessão pertence ao user, status = closed, ainda não avaliada
- Insere em `support_ratings`
- Registra na timeline

**`getSupportStats`** (admin action):
- Retorna avaliações agregadas: média geral, distribuição por nota, média por agente com nome, total de sessões por agente
- Filtrável por período (since_date)

---

### 3. Frontend: Avaliação pela usuária

**`src/pages/support/SupportTicketDetail.tsx`**:
- Quando `session.status === "closed"`, exibir card de avaliação com 5 estrelas clicáveis + textarea para comentário
- Após envio, exibir "Obrigada pela avaliação" com a nota dada
- Verificar se já foi avaliado ao carregar (nova flag retornada pelo `getMySession`)

---

### 4. Frontend: Aba "Suporte" em Admin Relatórios

**`src/pages/admin/AdminRelatorios.tsx`**:
- Nova aba `{ id: "suporte", label: "Suporte", icon: MessageCircle }`
- KPIs: Total Sessões, Média Geral, % Avaliadas, Total Agentes
- Gráfico de barras (Recharts `BarChart`): distribuição de notas 1-5
- Tabela Top 10 agentes: #, Nome, Sessões Atendidas, Nota Média, com ordenação por nota

---

### Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| migração SQL | Cria `support_ratings` |
| `supabase/functions/support-api/index.ts` | Actions `rateSession` + `getSupportStats` |
| `src/pages/support/SupportTicketDetail.tsx` | Card de avaliação pós-fechamento |
| `src/pages/admin/AdminRelatorios.tsx` | Nova aba "Suporte" com gráficos e Top 10 |

