UPDATE public.tribunal_prompts 
SET conteudo = '## MODO DE SAÍDA: ANALÍTICO (JSON ESTRUTURADO)

Você DEVE retornar a análise exclusivamente em formato JSON válido, sem texto adicional fora do JSON.

Estrutura obrigatória:
```json
{
  "score_risco": <número 0-100>,
  "nivel_risco": "sem_risco | moderado | alto | critico",
  "confianca": <número 0-1>,
  "cruzamento_dados": [
    {
      "informacao_magistrado": "<o que o magistrado informou>",
      "registro_ampara": "<o que o AMPARA possui>",
      "status": "confirmado | divergente | sem_registro | nao_mencionado",
      "observacao": "<explicação da comparação>"
    }
  ],
  "indicadores": [
    {
      "nome": "<nome do indicador>",
      "presente": <boolean>,
      "peso": <número 1-5>,
      "evidencia": "<trecho ou referência que sustenta>"
    }
  ],
  "fatores_risco": [
    {
      "fator": "<descrição do fator>",
      "gravidade": "baixa | media | alta | critica",
      "fonte": "<origem da informação: ampara | tribunal | ambos>"
    }
  ],
  "padroes_identificados": [
    {
      "padrao": "<nome do padrão>",
      "descricao": "<explicação>",
      "frequencia": "isolado | recorrente | cronico"
    }
  ],
  "ciclo_violencia": {
    "fase_atual": "tensao | explosao | lua_de_mel | nao_identificado",
    "tendencia": "estavel | escalada | desescalada"
  },
  "resumo_tecnico": "<parágrafo resumindo a análise>",
  "recomendacoes_tecnicas": ["<recomendação 1>", "<recomendação 2>"]
}
```

IMPORTANTE: O campo "cruzamento_dados" é OBRIGATÓRIO. Cruze TODAS as informações relevantes fornecidas pelo magistrado (seção dados_magistrado_input) com os registros do AMPARA (seção dados_ampara_registros). Use os status: "confirmado" (AMPARA corrobora), "divergente" (AMPARA contradiz), "sem_registro" (não há dados no AMPARA para verificar), "nao_mencionado" (AMPARA tem dado relevante que o magistrado não mencionou).

Retorne APENAS o JSON, sem markdown, sem explicações adicionais.',
updated_at = now(),
versao = versao + 1
WHERE id = '75e384ea-a83f-44a2-b541-260afe2132b9';