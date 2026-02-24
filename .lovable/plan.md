
## Formatar variavel VEICULO no formato natural

### O que muda
Atualmente o campo VEICULO e montado como: `Paraty, cor preta, placa adb 4j55`

O formato desejado e: `Paraty de cor preta, placa adb 4j55` (usando "de cor" em vez de separar com virgula).

### Alteracao

**Arquivo:** `supabase/functions/agreggar-speed-dial/index.ts` (linhas 136-141)

Trocar a logica de montagem do texto do veiculo:

- Se tem modelo e cor: `{modelo} de cor {cor}`
- Se tem placa, adiciona `, placa {placa}` ao final
- Se so tem modelo sem cor: `{modelo}`
- Se so tem cor sem modelo: `cor {cor}`
- Fallback: `nao informado`

Exemplo de resultado: **Paraty de cor preta, placa adb 4j55**

### Detalhe tecnico

```typescript
// Vehicle - formato: "Paraty de cor preta, placa adb 4j55"
const v = context.aggressor?.vehicle;
let veiculoStr = "";
if (v?.model && v?.color) {
  veiculoStr = `${v.model} de cor ${v.color}`;
} else if (v?.model) {
  veiculoStr = v.model;
} else if (v?.color) {
  veiculoStr = `cor ${v.color}`;
}
if (v?.plate_partial) {
  veiculoStr = veiculoStr
    ? `${veiculoStr}, placa ${v.plate_partial}`
    : `placa ${v.plate_partial}`;
}
add("VEICULO", veiculoStr || "não informado");
```
