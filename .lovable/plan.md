

# Agrupar marcadores por bairro nos mapas admin

## Contexto
Agrupar por bairro é o equilíbrio ideal: protege a privacidade das vítimas (sem coordenadas exatas) e mantém granularidade operacional útil para gestão. Os dados de `endereco_bairro`, `endereco_cidade` e coordenadas de endereço cadastrado já existem na tabela `usuarios`.

## Como funciona

Cada usuária será agrupada pela combinação `bairro + cidade + UF`. O marcador será posicionado na **média das coordenadas de endereço cadastrado** das usuárias daquele bairro (não GPS em tempo real). Isso dá uma posição aproximada do bairro sem revelar nenhum endereço individual.

Para bairros com apenas 1 usuária, as coordenadas serão arredondadas (3 casas decimais, ~110m de imprecisão) para não expor o endereço exato.

## Alterações

### 1. AdminMapa (`src/pages/admin/AdminMapa.tsx`)

**Marcadores de dispositivos (linhas 726-735):**
- Agrupar `devices` por `bairro + cidade + uf`
- Calcular centroide do bairro (média lat/lon dos endereços cadastrados, arredondada)
- Renderizar um marcador circular por bairro com contagem dentro (ex: "3")
- Tamanho proporcional: `min(12 + count * 3, 36)px`
- Cor: verde se maioria online, cinza se maioria offline, vermelho pulsante se há alerta ativo no bairro
- Sem popup com dados individuais - apenas tooltip com "Bairro X - N usuárias"

**Marcadores de alertas (linhas 715-724):**
- Agrupar alertas por bairro da usuária
- Remover nome da usuária do popup
- Mostrar apenas "N alertas ativos - Bairro X"

**Dados necessários:** Já temos `endereco_bairro`, `endereco_cidade`, `endereco_lat`, `endereco_lon` na query existente de usuários. Será necessário incluir esses campos na estrutura `devices`.

### 2. DashboardMapCard (`src/components/institucional/DashboardMapCard.tsx`)

- Mesma lógica de agrupamento por bairro
- Remover o bloco de detalhes individuais (linhas 592-608) que mostra nome, bateria, ping
- Substituir por informações agregadas do bairro

### 3. Privacidade extra

- Coordenadas arredondadas a 3 casas decimais (~110m)
- Bairros com 1 usuária: mostrar apenas o marcador sem tooltip identificável (só "1 usuária")
- Nunca exibir nome, bateria, último ping ou dispositivo

## Arquivos alterados
- `src/pages/admin/AdminMapa.tsx`
- `src/components/institucional/DashboardMapCard.tsx`

