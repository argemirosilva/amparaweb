
## Código do link de monitoramento — 6 dígitos numéricos

O código do link de monitoramento agora é uma sequência de **6 dígitos numéricos** (ex: `482731`), gerado via `crypto.getRandomValues`.

### Arquivos alterados

**Geração do código:**
- `supabase/functions/web-api/index.ts` — `createShareLink`: gera 6 dígitos numéricos
- `supabase/functions/send-whatsapp/index.ts` — geração do código GPS: 6 dígitos numéricos

**Parsing/formatação para voz:**
- `supabase/functions/agreggar-speed-dial/index.ts` — remove não-dígitos, separa com espaços (ex: `4 8 2 7 3 1`)
- `supabase/functions/copom-outbound-call/index.ts` — mesma lógica

**Tela de teste (AdminCopom):**
- `src/pages/admin/AdminCopom.tsx` — valores de teste atualizados para `482731`
