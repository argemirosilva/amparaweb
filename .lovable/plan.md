

# Remover Legenda de Cores de Gravacoes do Mapa Admin

## O que sera removido

O bloco de legenda localizado no canto inferior esquerdo do mapa que exibe a escala de cores por quantidade de gravacoes:
- 0 = cinza
- 1-9 = azul claro
- 10-29 = azul
- 30-79 = azul escuro
- 80+ = azul marinho

Tambem serao removidos os indicadores de tendencia ("Aumento" / "Declinio") que fazem parte do mesmo card de legenda.

## Arquivo a modificar

`src/pages/admin/AdminMapa.tsx` -- remover o bloco de legenda (linhas 730-749 aproximadamente), que inclui:
- O container `div` com `absolute bottom-3 left-3`
- Os chips de cor (0, 1-9, 10-29, 30-79, 80+)
- Os indicadores de tendencia (Aumento / Declinio)

O restante do conteudo do card (se houver itens adicionais apos a legenda dentro do mesmo container) sera verificado e preservado ou tambem removido conforme apropriado.

## Detalhes tecnicos

Remover o `div` que comeca na linha 730 com classe `absolute bottom-3 left-3` e todo seu conteudo (legenda de cores e indicadores de tendencia). Verificar se o container inclui mais conteudo alem da legenda para decidir se remove o container inteiro ou apenas os itens especificos.

