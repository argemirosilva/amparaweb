
## Enviar apenas o ID do link temporario (sem dominio)

Atualmente, o campo `LINK_MONITORAMENTO` envia o valor no formato `amparamulher.com.br/A 9 f 4 K 2`. A alteracao vai enviar **somente o codigo/ID** ja formatado para voz, sem o prefixo do dominio.

### Mudancas

**1. `supabase/functions/copom-outbound-call/index.ts`** (acionamento automatico)
- Linha 155: Alterar de `amparamulher.com.br/${codeSpeak || code}` para apenas `codeSpeak || code`
- O valor enviado sera, por exemplo, `A 9 f 4 K 2` em vez de `amparamulher.com.br/A 9 f 4 K 2`

**2. `supabase/functions/agreggar-speed-dial/index.ts`** (tela de teste)
- Linha 143: Mesma alteracao — remover o prefixo `amparamulher.com.br/` e enviar somente o codigo formatado para voz

### Detalhes tecnicos

Antes:
```typescript
add("LINK_MONITORAMENTO", code ? `amparamulher.com.br/${codeSpeak || code}` : undefined);
```

Depois:
```typescript
add("LINK_MONITORAMENTO", codeSpeak || code || undefined);
```

Nenhuma outra alteracao necessaria — banco, APIs e fluxo permanecem iguais.
