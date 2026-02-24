

## Curadoria Inline por Frase - Alertas com Validacao e Correcao

### Objetivo
Melhorar o sistema de curadoria inline nas frases da transcricao para que o curador possa:
1. Ver claramente qual alerta foi detectado ao lado de cada frase
2. Marcar se o alerta esta correto ou incorreto
3. Quando incorreto, selecionar o tipo correto de alerta/violencia a partir de uma lista predefinida
4. Tambem poder adicionar um alerta que nao foi detectado pela IA

### Mudancas

#### 1. Ampliar o `LineCurationPopover` (TranscriptionBubbles.tsx)

O popover atual so tem "Correto/Incorreto" e uma nota. Sera expandido para:

- Mostrar o alerta detectado que esta sendo avaliado (ex: "Xingamento: vagabunda")
- Opcao "Correto" / "Incorreto"
- Quando "Incorreto", exibir um dropdown para selecionar o tipo correto de alerta dentre as opcoes:
  - Xingamento
  - Ameaca
  - Violencia psicologica
  - Violencia fisica
  - Tatica manipulativa (gaslighting, isolamento, etc.)
  - Sinal de alerta
  - Nenhum (falso positivo)
- Campo de nota opcional

#### 2. Botao "Adicionar alerta" em frases SEM alertas

- Frases sem deteccao de alerta ganham um botao discreto (visivel no hover) para que o curador possa adicionar manualmente um tipo de alerta que a IA nao detectou
- Isso permite marcar falsos negativos (IA nao pegou, mas deveria)

#### 3. Atualizar a interface `LineCurationData`

Adicionar campos:
- `alert_type`: o tipo original do alerta sendo avaliado
- `alert_label`: o label original
- `corrected_type`: quando incorreto, o tipo correto selecionado pelo curador

#### 4. Atualizar a chamada de salvamento no `CuradoriaDetailDrawer`

O `onSaveLineCuration` passara os novos campos (`alert_type`, `corrected_type`) para a API `saveAvaliacao`, armazenando no `valor_corrigido`.

### Detalhes Tecnicos

**Arquivo:** `src/components/curadoria/TranscriptionBubbles.tsx`

- Criar constante `ALERT_TYPE_OPTIONS` com os tipos de alerta/violencia disponiveis
- Refatorar `LineCurationPopover` para receber os alertas da linha e renderizar uma avaliacao por alerta
- Adicionar botao "Adicionar alerta" para linhas sem deteccao
- Atualizar `LineCurationData` com os novos campos
- Manter o popover compacto e funcional

**Arquivo:** `src/components/curadoria/CuradoriaDetailDrawer.tsx`

- Atualizar o `onSaveLineCuration` para enviar os campos adicionais (`alert_type`, `alert_label`, `corrected_type`) no payload da API

### Fluxo do Curador

```text
Frase com alerta detectado:
+-------------------------------------------------------+
| "Vou meter a mao na tua orelha"                       |
| [Ameaca] [Violencia fisica]     [Avaliar]             |
+-------------------------------------------------------+
         |
         v  (clica Avaliar)
    +---------------------------+
    | Alerta: Ameaca            |
    | ( ) Correto  ( ) Incorreto|
    | [Tipo correto: ________v] |  <-- so aparece se Incorreto
    | Nota: ________________    |
    | [Salvar]                  |
    +---------------------------+

Frase SEM alerta:
+-------------------------------------------------------+
| "Nao enche, velho"                    [+ Alerta]      |
+-------------------------------------------------------+
         |
         v  (clica + Alerta)
    +---------------------------+
    | Tipo: [______________ v]  |
    | Nota: ________________    |
    | [Salvar]                  |
    +---------------------------+
```

