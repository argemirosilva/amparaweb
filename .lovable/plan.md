

## Formatar Transcrição na Curadoria

### Objetivo
Limpar e formatar a transcrição anonimizada exibida no drawer de detalhes, removendo timestamps, metadados (como "[00:01:23]", "Speaker 1:", etc.) e exibindo uma frase por linha.

### Alteracoes

**Arquivo: `src/components/curadoria/CuradoriaDetailDrawer.tsx`**

1. Criar uma funcao `formatTranscricao(raw: string): string` que:
   - Remove padroes de timestamp como `[00:01:23]`, `(00:01:23)`, `00:01:23 -`, etc.
   - Remove prefixos de speaker/falante como `Speaker 1:`, `Falante 1:`, `SPEAKER_00:`, etc.
   - Separa o texto em frases (por `.`, `!`, `?` ou quebras de linha existentes)
   - Retorna o texto limpo com uma frase por linha (trim de espacos extras)

2. Aplicar a funcao na exibicao da transcricao (linha 190), substituindo `{selected.transcricao_anonimizada}` por `{formatTranscricao(selected.transcricao_anonimizada)}`

3. Tambem aplicar na preview da tabela em `AdminCuradoria.tsx` (linha que faz `.slice(0, 80)`) para que o preview tambem mostre texto limpo.

### Detalhes tecnicos

A funcao de formatacao usara regex para limpar os padroes mais comuns:

```typescript
function formatTranscricao(raw: string): string {
  if (!raw) return "";
  let text = raw
    // Remove timestamps [00:00:00], (00:00:00), 00:00:00 -, etc.
    .replace(/[\[\(]?\d{1,2}:\d{2}(:\d{2})?[\]\)]?\s*[-–:]?\s*/g, "")
    // Remove speaker labels: "Speaker 1:", "Falante 1:", "SPEAKER_00:", etc.
    .replace(/\b(speaker|falante|spk|SPEAKER)[_ ]?\d*\s*[:]\s*/gi, "")
    // Remove leading dashes/bullets
    .replace(/^\s*[-–•]\s*/gm, "");

  // Split into sentences and filter empty
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return sentences.join("\n");
}
```

Impacto minimo: apenas formatacao visual, sem alteracao de dados.
