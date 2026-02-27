

# Fallback de coordenadas no acionamento de panico

## Problema
Quando o app iOS aciona panico, pode ainda nao ter enviado coordenadas nesse request (ou envia 0,0). O alerta fica registrado sem localizacao, mesmo que o ultimo ping ja tenha enviado GPS valido segundos antes.

## Solucao
Na funcao `handleAcionarPanico` do `mobile-api/index.ts`, apos extrair `latitude`/`longitude` do body, verificar se sao validas. Se nao forem (null, undefined, ou ambas zero), consultar a ultima localizacao valida da tabela `localizacoes` para aquele `user_id`.

## Detalhes tecnicos

### Arquivo: `supabase/functions/mobile-api/index.ts`

Na funcao `handleAcionarPanico`, apos as linhas 1369-1370 (extracao de lat/lon do body), adicionar fallback:

```typescript
const loc = body.localizacao as Record<string, unknown> | undefined;
let latitude = (body.latitude ?? loc?.latitude) as number | undefined;
let longitude = (body.longitude ?? loc?.longitude) as number | undefined;

// Fallback: if no valid coords from request, use latest known location from pings
if (latitude == null || longitude == null || (latitude === 0 && longitude === 0)) {
  const { data: lastLoc } = await supabase
    .from("localizacoes")
    .select("latitude, longitude")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastLoc && (lastLoc.latitude !== 0 || lastLoc.longitude !== 0)) {
    latitude = lastLoc.latitude;
    longitude = lastLoc.longitude;
  }
}
```

### Impacto
- Contrato da API nao muda (mesmos campos de entrada e saida)
- Se o app ja envia coordenadas validas, nada muda
- Se nao envia, o alerta e a notificacao aos guardioes/COPOM ja saem com a localizacao mais recente disponivel
- Retrocompativel com Android e futuras versoes do iOS

