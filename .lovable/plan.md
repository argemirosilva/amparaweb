
# Corrigir Exibicao de Gravacoes no Dashboard Admin

## Problema

A tabela `gravacoes` tem Row-Level Security (RLS) habilitado mas **nenhuma politica SELECT** configurada. Isso faz com que todas as queries do cliente retornem 0 resultados, mesmo havendo 305 gravacoes nos ultimos 30 dias (192 em SP, 27 no RJ, 22 em MG, etc.).

O mesmo ocorre com `gravacoes_analises`, que tem uma politica `ALL` com expressao `false`, bloqueando leitura.

## O que sera feito

### 1. Migracao SQL -- Adicionar politicas de leitura

Criar politicas SELECT para permitir leitura anonima (mesmo padrao usado em `alertas_panico`, `device_status`, `localizacoes` e outras tabelas do sistema):

**Tabela `gravacoes`:**
- Adicionar politica `Allow anon select gravacoes` com `USING (true)` para comando SELECT

**Tabela `gravacoes_analises`:**
- Remover a politica restritiva `Block direct access gravacoes_analises` (que bloqueia ALL com `false`)
- Adicionar politica `Allow anon select gravacoes_analises` com `USING (true)` para comando SELECT
- Adicionar politica `Block direct write gravacoes_analises` para INSERT/UPDATE/DELETE com `USING (false)`

### 2. Nenhuma alteracao de codigo

O codigo em `AdminMapa.tsx` ja esta correto -- faz as queries, calcula por UF, exibe no mapa e nos KPIs. O unico problema e que as queries retornam vazio por causa do bloqueio de RLS.

### Resultado esperado

Apos a migracao:
- Os 6 KPI cards no topo mostrarao Gravacoes (305+) e Horas Gravadas
- O mapa coropletho ficara colorido por volume de gravacoes (SP em azul escuro)
- Os labels dos estados mostrarao "SP 192" com o icone de microfone
- As setas de tendencia (up/down) apareceriao abaixo dos labels
- O tooltip ao passar o mouse mostrara os dados de gravacao
- O sidebar lateral mostrara o ranking de UFs por gravacoes
