

# Pagina de Mapa - Localizacao do Dispositivo

## Status: ✅ Implementado

## O que foi feito

### Pagina `/mapa`
- Mapa interativo Leaflet sem attribution/logo/bandeira
- Marcador customizado com foto de perfil (ou inicial do nome) em circulo
- Primeiro nome da usuaria abaixo da foto
- Estado de movimento: Parada (speed=0/null), Caminhando (<15km/h), Veiculo (>=15km/h)
- Panico ativo: borda vermelha pulsante ao redor da foto
- Resolucao de endereco via reverseGeocodeService (Nominatim)
- Logica "Em Casa": se distancia <= 50m do endereco_fixo cadastrado, mostra 🏠 Em Casa
- Polling a cada 30 segundos

### Arquivos criados
- `src/pages/Mapa.tsx` — pagina do mapa
- `src/hooks/useMapDeviceData.ts` — hook com dados de localizacao, panico, perfil e geocoding

### Arquivos modificados
- `src/App.tsx` — rota `/mapa`
- `src/components/layout/AppSidebar.tsx` — item Mapa na sidebar
- `src/components/layout/BottomNav.tsx` — item Mapa na bottom nav

### Dependencias adicionadas
- `leaflet`
- `@types/leaflet`
