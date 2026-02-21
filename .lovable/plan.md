

# Redistribuir Gravacoes nos Ultimos 90 Dias com Padroes de Escalada/Decaida

## Contexto

- **550 gravacoes** distribuidas entre **55 usuarias**
- **374 analises** vinculadas (com niveis: critico 83, alto 114, moderado 171, sem_risco 6)
- Objetivo: espalhar registros ao longo de 90 dias simulando ciclos realistas de violencia

## Estrategia de Distribuicao

Dividir as 55 usuarias em 4 perfis comportamentais:

| Perfil | % Usuarias | Padrao Temporal |
|--------|-----------|-----------------|
| **Escalada progressiva** | ~30% | Poucas gravacoes no inicio, aumentando em frequencia e risco nas ultimas semanas |
| **Decaida (melhora)** | ~25% | Muitas gravacoes no inicio, diminuindo ao longo do tempo |
| **Pico e retorno** | ~25% | Periodo calmo, pico intenso no meio, volta a estabilizar |
| **Constante/cronico** | ~20% | Distribuicao uniforme ao longo dos 90 dias |

## Implementacao

Criar uma **Edge Function utilitaria** (`seed-recordings-timeline`) que:

1. Busca todas as gravacoes agrupadas por `user_id`
2. Atribui cada usuaria a um perfil aleatorio (com os pesos acima)
3. Para cada gravacao da usuaria, calcula um novo `created_at` baseado no perfil:
   - **Escalada**: datas concentradas nos ultimos 20-30 dias, com peso exponencial crescente
   - **Decaida**: datas concentradas nos primeiros 30 dias, decrescente
   - **Pico**: cluster no periodo entre dia 30-50
   - **Constante**: distribuicao uniforme nos 90 dias
4. Atualiza `created_at` e `updated_at` de cada gravacao
5. Atualiza tambem o `created_at` das `gravacoes_analises` correspondentes para manter consistencia
6. Gera horarios variados (06h-23h) com peso maior em horarios noturnos (19h-23h) para realismo

## Detalhes Tecnicos

### Edge Function `seed-recordings-timeline`

- Rota protegida: exige `session_token` de admin
- Parametro opcional `dry_run: true` para preview sem alterar dados
- Retorna resumo: quantas gravacoes por perfil, distribuicao temporal

### Campos atualizados

- `gravacoes.created_at` -- nova data/hora
- `gravacoes.updated_at` -- mesma nova data + poucos minutos
- `gravacoes_analises.created_at` -- alinhado com a gravacao correspondente

### Logica de horario

- 60% entre 19h-23h (periodo noturno, mais realista)
- 25% entre 12h-18h
- 15% entre 06h-11h

### Arquivos

- **Criar**: `supabase/functions/seed-recordings-timeline/index.ts`
- Executar uma unica vez via curl/fetch, depois pode ser removida

### Execucao

Apos deploy, chamar a funcao passando o token de admin. A funcao processa tudo em batch e retorna o resumo.
