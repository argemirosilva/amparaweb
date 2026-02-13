

## Atualização em tempo real fluida para os mapas

### Problema atual

Hoje, quando uma nova localização chega via Realtime, o hook `useMapDeviceData` (usado na pagina Mapa) **descarta o payload** e faz 4 queries ao banco + geocodificação reversa. Isso cria um atraso perceptível de 1-3 segundos entre a chegada do dado e a atualização visual. Na pagina Rastreamento, o payload ja e usado diretamente, mas a geocodificação reversa ainda bloqueia a atualização visual.

### Solução

Separar a atualização de coordenadas (instantanea) da atualização de endereço (assíncrona), e usar o payload do Realtime diretamente em vez de re-consultar o banco.

### Mudanças planejadas

**1. Refatorar `useMapDeviceData.ts`**
- Usar o payload do Realtime diretamente para atualizar latitude, longitude, speed, precisao_metros e created_at -- sem re-fetch
- Mover dados estáticos (perfil, avatar, endereco_fixo) para um fetch separado que roda apenas uma vez e ao montar o componente
- Atualizar o endereço de forma assíncrona (sem bloquear a posição do marcador)
- Manter o polling de 30s como fallback, mas o Realtime passa a ser o canal primário

**2. Ajustar `Mapa.tsx`**
- Reduzir o intervalo do tick de 5s para 3s para textos relativos mais responsivos
- Garantir que a animação suave do marcador inicie imediatamente ao receber dados do Realtime

**3. Ajustar `Rastreamento.tsx`**
- Atualizar endereço de forma assíncrona (primeiro move o marcador, depois atualiza o texto do endereço)
- Reduzir o tick de 15s para 3s para consistencia com a pagina Mapa
- Recalcular stationarySince de forma incremental usando o histórico local em vez de re-consultar

### Detalhes técnicos

```text
Fluxo atual (Mapa):
  Realtime INSERT → fetchData() → 4 queries SQL + geocode → setData → render
  Latencia: ~1-3 segundos

Fluxo novo (Mapa):
  Realtime INSERT → payload direto → setData (coords) → render imediato
                  → geocode async → setData (endereço) → re-render suave
  Latencia: ~50-100ms para posição, endereço atualiza em background
```

A mudança principal no hook sera:

- Na subscription Realtime de `localizacoes`, em vez de chamar `fetchData()`, extrair os campos do payload e fazer um `setData(prev => ({...prev, latitude, longitude, speed, ...}))` instantaneo
- Disparar `resolveAddress()` em paralelo e atualizar o campo `geo` quando resolver
- Buscar dados do perfil (avatar, nome, endereco_fixo) apenas no mount e cachear

Isso elimina as 4 queries redundantes a cada nova localização e deixa a experiencia muito mais fluida, como um navegador GPS real.

