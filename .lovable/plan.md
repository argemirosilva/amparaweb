
# Adicionar Modo Direcionado ao Gerador de Audios

## Problema
O gerador de audios esta com `randomMode = true` fixo (hardcoded), impossibilitando direcionar a geracao para uma usuaria especifica como "Ana Paula". Para testar o relatorio "Como estou?", precisamos gerar audios concentrados em uma unica usuaria.

## Mudancas

### 1. Tornar `randomMode` um estado togglevel (`src/pages/admin/AdminGeradorAudios.tsx`)

- Trocar `const randomMode = true` por `const [randomMode, setRandomMode] = useState(true)`
- Adicionar um toggle (Switch) na UI para alternar entre "Aleatorio" e "Direcionado"
- Quando em modo direcionado, exibir:
  - Seletor de usuaria (ja existe `targetUserId` e `usuarios` no state)
  - Seletor de tipo de audio (violencia / briga saudavel) -- ja existe `audioMode`
- O card de info no topo muda conforme o modo selecionado

### 2. UI do modo direcionado
- Mostrar um card com o selector de usuaria (dropdown com nome + email)
- Mostrar selector de tipo de audio
- O botao de gerar mostra o nome da usuaria selecionada

### Detalhes tecnicos
- Linha 112: `const randomMode = true` vira `const [randomMode, setRandomMode] = useState(true)`
- Adicionar card condicional com Select de usuario e Select de audioMode quando `!randomMode`
- A logica de `handleStart` ja suporta ambos os modos (linhas 171-250), so precisa do toggle na UI
