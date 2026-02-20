

## Reduzir marcadores online para pontos pequenos

### Problema
Com grande volume de dispositivos, os marcadores de 20px ficam visualmente poluidos e sobrepostos no mapa.

### Mudanca

**Arquivo: `src/pages/admin/AdminMapa.tsx` (linha 363)**

Reduzir o marcador de dispositivos online de 20px para 8px, remover a borda branca grossa e reduzir a sombra para manter o visual limpo em escala:

- **Online**: ponto verde de 8x8px, borda de 1px branca, sombra sutil
- **Offline**: manter cinza mas tambem reduzir para 8x8px para consistencia

O popup com detalhes continuara funcionando ao clicar no ponto.

### Detalhe tecnico

Alterar a linha 363 de:
```
width:20px;height:20px;border-radius:50%;...;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)
```
Para:
```
width:8px;height:8px;border-radius:50%;...;border:1px solid white;box-shadow:0 0 2px rgba(0,0,0,0.15)
```

Tambem fazer a mesma reducao no `DashboardMapCard.tsx` (linha ~225) que usa marcadores de 16px, para manter consistencia entre os dois mapas.

