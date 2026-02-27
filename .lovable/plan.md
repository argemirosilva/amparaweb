

# Filtros de Busca em Gravacoes

## Novos filtros

1. **Busca por transcricao** -- campo de texto que filtra gravacoes cujo conteudo transcrito contenha o termo digitado
2. **Filtro por data** -- seletor de periodo (data inicio / data fim)
3. **Filtro por origem** -- dispositivo (Celular / Web / Todos)

## Mudancas

### 1. Backend: `web-api/index.ts` -- action `getGravacoes`
- Aceitar novos parametros: `search_text`, `date_from`, `date_to`, `device_type`
- `search_text`: aplicar `.ilike("transcricao", `%${search_text}%`)` na query de gravacoes
- `date_from` / `date_to`: aplicar `.gte("created_at", date_from)` e `.lte("created_at", date_to)`
- `device_type`: se "web" filtrar `.eq("device_id", "web")`, se "mobile" filtrar `.neq("device_id", "web").not("device_id", "is", null)`

### 2. Frontend: `src/pages/Gravacoes.tsx`
- Adicionar estados: `searchText`, `debouncedSearch`, `dateFrom`, `dateTo`, `deviceFilter`
- Implementar debounce de 500ms para o campo de busca por transcricao
- Renderizar barra de filtros compacta abaixo dos chips de risco existentes:
  - Input com icone Search e placeholder "Buscar na transcricao..."
  - Dois inputs `type="date"` compactos (De / Ate)
  - Select compacto com opcoes: Todos, Web, Celular
- Passar os novos parametros para `callWebApi("getGravacoes", ...)`
- Resetar pagina para 1 ao alterar qualquer filtro
- Botao discreto "Limpar filtros" visivel quando algum filtro esta ativo

### Detalhes tecnicos

**Debounce**: useEffect com setTimeout de 500ms no `searchText` para evitar chamadas excessivas a API.

**Layout**: A barra de filtros avancados sera um componente compacto, colapsavel em mobile (toggle "Filtros" que expande), sempre visivel em desktop. Usara flex-wrap para acomodar os campos.

**Componentes reutilizados**: `Input` de `@/components/ui/input`, `Select` de `@/components/ui/select`, icones do Lucide (`Search`, `Filter`, `X`).

