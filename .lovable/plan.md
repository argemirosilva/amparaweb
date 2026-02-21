
# Visualizacao de Recursos com Grant Ativo -- Painel do Agente

## Problema Atual

O backend (`getResource`) ja valida o grant e retorna dados (metadados, transcricao, analise, logs), mas o frontend do agente (`SuporteChat.tsx`) nao tem nenhum botao ou painel para o agente **visualizar** o recurso apos o acesso ser concedido.

## Solucao

Adicionar ao sidebar do chat (onde ja aparecem os grants ativos) um botao **"Visualizar Recurso"** em cada grant ativo. Ao clicar, o sistema chama `getResource` e exibe os dados em um painel/modal.

---

## Alteracoes

### 1. `src/pages/suporte/SuporteChat.tsx`

**Novo state:**
- `resourceData` (any | null) -- dados retornados pelo `getResource`
- `loadingResource` (boolean) -- loading do fetch
- `viewingGrant` (any | null) -- grant sendo visualizado (para contexto do tipo/escopo)

**Nova funcao `handleViewResource(grant)`:**
- Chama `callSupportApi("getResource", sessionToken, { grant_id, resource_type, resource_id })`
- Armazena resposta em `resourceData`
- Abre modal/painel

**No sidebar, dentro de cada grant ativo:**
- Adicionar botao "Visualizar" (icone `Eye`) ao lado de "Revogar"
- Ao clicar: chama `handleViewResource`

**Novo Dialog/Modal "Visualizacao do Recurso":**
- Header: tipo do recurso + escopo + countdown do grant
- Body renderiza conforme o tipo:
  - **Metadados**: tabela com data, duracao, tamanho, status, device
  - **Transcricao**: texto formatado (read-only, sem copiar)
  - **Analise**: resumo, nivel de risco, sentimento, categorias, palavras-chave
  - **Logs**: tabela com device_status (ping, bateria, versao, etc.)
  - **Audio streaming**: botao "Ouvir" que usa o `proxyAudio` existente via `web-api` (WaveformPlayer ou audio element com URL temporaria)
- Footer: botao "Fechar" + "Revogar acesso"

### 2. Audio Streaming (escopo `read_audio_stream`)

O `getResource` retorna `{ storage_path, stream_hint }`. Para reproduzir:
- Usar o proxy de audio ja existente no `web-api` (action `proxyAudio`)
- Montar URL: `SUPABASE_URL/functions/v1/web-api` com body `{ action: "proxyAudio", session_token, path: storage_path }`
- Renderizar um player de audio simples (elemento `<audio>` com source blob ou WaveformPlayer)

### 3. Seguranca no Frontend

- Desabilitar selecao de texto na transcricao (CSS `user-select: none`)
- Nao exibir URLs de storage ao agente
- Cada clique em "Visualizar" gera log no backend (ja implementado no `getResource`)
- Se o grant expirar enquanto visualiza, fechar modal automaticamente

---

## Detalhes Tecnicos

### Renderizacao por tipo de recurso

```text
resource_type + scope -> Componente
-------------------------------------------------
recording + read_metadata    -> Tabela de metadados
recording + read_transcription -> Bloco de texto
recording + read_audio_stream  -> Player de audio
analysis  + read_analysis      -> Card de analise
transcription + read_transcription -> Bloco de texto
metadata  + read_metadata      -> Tabela de metadados
logs      + read_logs          -> Tabela de logs
```

### Arquivos afetados

- `src/pages/suporte/SuporteChat.tsx` -- adicionar botao, state, modal de visualizacao
- Nenhuma alteracao no backend (ja implementado)
