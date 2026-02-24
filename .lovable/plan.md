

## Ajustes no grafico "Alertas por Tipo de Acionamento"

### Mudancas

No mapeamento `ACIONAMENTO_LABELS` (linha 74-76 de `src/pages/admin/AdminMapa.tsx`):

1. **Agrupar "manual" com "Botao" como "Manual"**: os tipos `botao_fisico`, `botao_manual`, `botao`, `manual` passam a exibir "Manual"
2. **Agrupar "automatico" com "voz" como "Automatico"**: os tipos `automatico`, `voz` passam a exibir "Automatico"
3. **Renomear `botao_panico` para "Panico"**: o tipo `botao_panico` exibe "Panico"

### Detalhe tecnico

**Arquivo:** `src/pages/admin/AdminMapa.tsx` (linhas 74-76)

De:
```typescript
const ACIONAMENTO_LABELS: Record<string, string> = {
  app: "Aplicativo", botao_fisico: "Botão", botao_manual: "Botão", botao: "Botão", automatico: "Automático",
};
```

Para:
```typescript
const ACIONAMENTO_LABELS: Record<string, string> = {
  app: "Aplicativo",
  botao_fisico: "Manual", botao_manual: "Manual", botao: "Manual", manual: "Manual",
  automatico: "Automático", voz: "Automático",
  botao_panico: "Pânico",
};
```

A logica existente na linha 491 ja agrupa valores com o mesmo label, entao os tipos mapeados para "Manual" serao somados automaticamente, assim como os mapeados para "Automatico".
