

# Migrar Google Maps para Mapbox -- Unificar Stack de Mapas

## Resumo

Substituir todas as implementacoes Google Maps (Mapa, MiniLeafletMap, Rastreamento) por Mapbox GL JS, reutilizando o padrao ja existente no AdminMapa e TransparenciaMapa. Ao final, o projeto usara apenas Mapbox como provedor de mapas.

---

## Componentes Afetados

| Arquivo | Usa Hoje | Acao |
|---|---|---|
| `src/hooks/useGoogleMaps.ts` | Google Maps | Substituir por `useMapbox.ts` |
| `src/components/dashboard/MiniLeafletMap.tsx` | Google Maps | Reescrever com Mapbox |
| `src/pages/Mapa.tsx` | Google Maps | Reescrever com Mapbox |
| `src/pages/Rastreamento.tsx` | Google Maps (public) | Reescrever com Mapbox |
| `src/pages/admin/AdminMapa.tsx` | Mapbox (inline) | Migrar para usar hook compartilhado |
| `src/pages/transparencia/TransparenciaMapa.tsx` | Mapbox (inline) | Migrar para usar hook compartilhado |
| `supabase/functions/google-maps-key/index.ts` | Edge Function | Remover |
| `supabase/functions/google-maps-key-public/index.ts` | Edge Function | Remover |
| `supabase/functions/mapbox-token/index.ts` | Edge Function | Manter (ja existe) |

---

## Etapas

### 1. Criar hook `useMapbox`

Novo arquivo `src/hooks/useMapbox.ts` que:
- Busca o token via edge function `mapbox-token` (ja existente)
- Faz import dinamico de `mapbox-gl`
- Retorna `{ mapboxgl, loading, error }`
- Versao autenticada e publica (token publico, sem sessao)
- Cacheia token e modulo para evitar recarregamentos

### 2. Migrar `MiniLeafletMap.tsx`

- Trocar Google Maps `Map` por `mapboxgl.Map` com `interactive: false`
- Trocar `AdvancedMarkerElement` por `mapboxgl.Marker({ element })` com HTML overlay customizado (mesmo visual dos aneis gradientes e avatares)
- Manter as mesmas props e comportamento visual

### 3. Migrar `Mapa.tsx` (GPS em tempo real)

- Substituir `google.maps.Map` por `mapboxgl.Map` com estilo escuro
- Substituir `AdvancedMarkerElement` por `mapboxgl.Marker({ element })`
- Adaptar `smoothPanMarker` para usar `marker.setLngLat()` com `requestAnimationFrame` (mesma tecnica)
- Substituir `google.maps.Circle` por source GeoJSON + layer `circle` do Mapbox
- Substituir `map.addListener("dragstart")` por `map.on("dragstart")`
- Manter HUD overlay inalterado (e HTML puro, nao depende do provedor)

### 4. Migrar `Rastreamento.tsx` (tracking publico)

- Mesma abordagem do Mapa.tsx
- Usar versao publica do hook (sem autenticacao)
- Manter toda logica de Supabase Realtime inalterada
- Manter marcadores com avatar, seta, animacao de panico

### 5. Refatorar AdminMapa e TransparenciaMapa

- Substituir import dinamico inline de `mapbox-gl` pelo novo hook `useMapbox`
- Substituir fetch inline do token pela logica do hook
- Manter toda logica de choropleth, popups e marcadores

### 6. Remover Google Maps

- Deletar `src/hooks/useGoogleMaps.ts`
- Deletar `supabase/functions/google-maps-key/index.ts`
- Deletar `supabase/functions/google-maps-key-public/index.ts`
- Remover entradas `google-maps-key` e `google-maps-key-public` do `supabase/config.toml`
- Desinstalar `@types/google.maps` do package.json
- Remover todas as linhas `/// <reference types="google.maps" />`

---

## Detalhes Tecnicos

### Mapeamento de APIs

| Google Maps | Mapbox GL JS |
|---|---|
| `new maps.Map(el, opts)` | `new mapboxgl.Map({ container: el, ...opts })` |
| `map.setCenter(pos)` | `map.setCenter([lng, lat])` |
| `map.panTo(pos)` | `map.panTo([lng, lat])` |
| `map.setZoom(n)` | `map.setZoom(n)` |
| `AdvancedMarkerElement({ content })` | `new mapboxgl.Marker({ element }).setLngLat([lng,lat]).addTo(map)` |
| `marker.position = pos` | `marker.setLngLat([lng,lat])` |
| `new maps.Circle(opts)` | GeoJSON source + layer tipo `circle` |
| `map.addListener("dragstart", fn)` | `map.on("dragstart", fn)` |
| `gestureHandling: "none"` | `interactive: false` (MiniMap) |
| `gestureHandling: "greedy"` | `dragPan: true, touchZoomRotate: true` (padrao) |

### Estilo do Mapa

- Mapa/Rastreamento: estilo escuro customizado (raster tiles dark, consistente com a identidade visual)
- MiniMap: mesmo estilo escuro, sem controles
- Admin/Transparencia: mantêm estilos atuais

### Animacao Suave de Marcador

A funcao `smoothPanMarker` sera adaptada para Mapbox:

```text
function smoothPanMarker(marker, from, to, duration) {
  // requestAnimationFrame loop
  // ease interpolation
  // marker.setLngLat([interpolatedLng, interpolatedLat])
}
```

### Circulo de Precisao

Substituir `google.maps.Circle` por:

```text
map.addSource("accuracy", { type: "geojson", data: circleGeoJSON })
map.addLayer({ id: "accuracy", type: "fill", source: "accuracy", paint: {...} })
```

Usar `turf.circle()` ou gerar GeoJSON manualmente para o poligono circular.

---

## Ordem de Execucao

1. Criar `useMapbox.ts` (hook compartilhado)
2. Migrar `MiniLeafletMap.tsx`
3. Migrar `Mapa.tsx`
4. Migrar `Rastreamento.tsx`
5. Refatorar `AdminMapa.tsx` e `TransparenciaMapa.tsx` para usar hook
6. Limpar arquivos Google Maps e edge functions
7. Testar todos os mapas

