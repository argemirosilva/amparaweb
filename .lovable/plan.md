

## Guia: Criar API Key do Google Maps

### Passo a passo no Google Cloud Console

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto novo (ou use um existente)
3. No menu lateral, va em **APIs e Servicos** > **Biblioteca**
4. Busque por **Maps JavaScript API** e clique em **Ativar**
5. No menu lateral, va em **APIs e Servicos** > **Credenciais**
6. Clique em **Criar credenciais** > **Chave de API**
7. Copie a chave gerada
8. (Recomendado) Clique em **Restringir chave** e adicione restricao por **Referenciadores HTTP** com os dominios:
   - `https://ampamamulher.lovable.app/*`
   - `https://*.lovable.app/*`
   - `localhost:*` (para desenvolvimento)

**Importante**: O Google Maps tem um tier gratuito de US$200/mes (~28.000 carregamentos de mapa). Para uso pessoal/pequeno, provavelmente nao havera custo. Voce precisara cadastrar um cartao de credito no Google Cloud, mas so sera cobrado se ultrapassar o limite gratuito.

---

## Plano de Integracao no Sistema

Depois que voce tiver a API Key, farei as seguintes alteracoes:

### 1. Armazenar a chave de forma segura
- Salvar a API Key como secret no backend (acessivel via variavel de ambiente)
- Criar uma edge function `google-maps-key` que retorna a chave de forma segura para o frontend

### 2. Substituir Leaflet por Google Maps em 3 arquivos

**src/pages/Mapa.tsx** (mapa principal)
- Remover imports do Leaflet
- Carregar Google Maps JS API dinamicamente
- Recriar os marcadores customizados (avatar, status de movimento, endereco) usando `google.maps.marker.AdvancedMarkerElement` com HTML overlay
- Manter toda a logica de dados existente (useMapDeviceData, useMovementStatus)

**src/pages/Rastreamento.tsx** (rastreamento temporario)
- Mesma substituicao de Leaflet para Google Maps
- Marcador identico ao do Mapa.tsx
- Manter logica de compartilhamento, realtime e estados

**src/components/dashboard/MiniLeafletMap.tsx** (mini mapa no dashboard)
- Substituir por mini Google Map estatico/interativo
- Manter o marcador com avatar e nome

### 3. Remover dependencia do Leaflet
- Remover pacotes `leaflet` e `@types/leaflet` do projeto
- Remover CSS do Leaflet

### Secao Tecnica

- A API Key sera carregada via edge function para nao ficar exposta no codigo fonte
- O Google Maps JS API sera carregado dinamicamente via script tag com callback
- Os marcadores customizados usarao `AdvancedMarkerElement` com conteudo HTML, mantendo o mesmo visual atual (anel gradiente, avatar, info de movimento)
- Nenhuma alteracao na logica de dados ou banco de dados sera necessaria

