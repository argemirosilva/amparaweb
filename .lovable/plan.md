

# Capturar numero da rua no endereço do GPS

## O que muda

O serviço de geocodificação reversa (`reverseGeocodeService.ts`) já recebe o campo `house_number` do Nominatim, mas atualmente o ignora. A mudança inclui esse campo na formatação do endereço.

Essa mesma mudança também resolve o filtro de endereço para a ElevenLabs (enviar somente rua, numero e bairro).

## Resultado esperado

| Antes | Depois |
|---|---|
| Rua José Gonçalves, Residencial Estoril, Bauru - SP | Rua José Gonçalves, 67 - Residencial Estoril, Bauru - SP |

Para a ElevenLabs (filtrado):
| Antes | Depois |
|---|---|
| Rua José Gonçalves, Residencial Estoril, Bauru - SP | Rua José Gonçalves, 67 - Residencial Estoril |

## Limitacoes

- A precisao depende do GPS do dispositivo (tipicamente 10-15m em areas urbanas)
- Em areas rurais ou vias sem numeracao cadastrada no OpenStreetMap, o campo pode vir vazio
- O sistema ja lida com campos ausentes, entao nao ha risco de erro

## Detalhes tecnicos

### 1. `src/services/reverseGeocodeService.ts` - funcao `formatAddress`

Adicionar `addr.house_number` ao lado de `addr.road`:

```typescript
// Antes
if (addr.road) parts.push(addr.road);

// Depois
if (addr.road) {
  parts.push(addr.house_number ? `${addr.road}, ${addr.house_number}` : addr.road);
}
```

Isso afeta todas as telas que usam geocodificacao (Mapa, Rastreamento, Dashboard, COPOM).

### 2. `supabase/functions/copom-outbound-call/index.ts` - filtro para ElevenLabs

Duas mudancas no bloco de `dynamicVariables`:

**Endereco** - truncar apos o bairro (remover cidade/estado):
```typescript
const rawAddr = context.location?.address || "";
const addrParts = rawAddr.split(",").map(s => s.trim());
// Pegar ate 3 partes: rua+numero, bairro (ignorar cidade, estado)
dynamicVariables.ENDERECO_ULTIMA_LOCALIZACAO = addrParts.slice(0, 2).join(", ");
```

Nota: o endereco chega no formato "Rua X, 67 - Bairro, Cidade - UF". O separador " - " entre bairro e rua faz parte do texto, entao a logica de split por virgula ja isola corretamente.

**Forca de seguranca** - remover texto entre parenteses:
```typescript
const rawForca = context.aggressor?.forca_seguranca_tipo || "sim, tipo não especificado";
dynamicVariables.AGRESSOR_FORCA_SEGURANCA = context.aggressor?.forca_seguranca
  ? rawForca.replace(/\s*\(.*?\)/g, "").trim()
  : "não";
```

### 3. Redeploy das edge functions

- `copom-outbound-call`

