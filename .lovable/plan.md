

## Plano: Importação de Conversas WhatsApp — Foco na Experiência

### Conceito de UX

Em vez de uma página separada com formulários tradicionais, a experiência será um **fluxo guiado tipo wizard** integrado na tela de Gravações, acessível por um botão atrativo. O processo todo acontece em **3 passos visuais** dentro de um drawer/modal fullscreen no mobile:

```text
┌─────────────────────────────────────────┐
│  Passo 1: "Cola aqui"                  │
│  ┌─────────────────────────────────┐    │
│  │  Área grande de drag & drop     │    │
│  │  ou colar texto (ctrl+v)        │    │
│  │  com ícone animado do WhatsApp  │    │
│  └─────────────────────────────────┘    │
│  + Mini tutorial visual (3 prints)     │
├─────────────────────────────────────────┤
│  Passo 2: "Quem é ele?"                │
│  Auto-detecta nomes da conversa        │
│  Usuária só toca no nome do parceiro   │
├─────────────────────────────────────────┤
│  Passo 3: "Analisando..."              │
│  Animação de progresso com frases      │
│  motivacionais enquanto processa       │
│  → Resultado aparece como timeline     │
└─────────────────────────────────────────┘
```

### Diferenciais de UX

1. **Colar direto** — A usuária pode simplesmente copiar a conversa no WhatsApp e colar (Ctrl+V / long press) numa área grande. Sem precisar exportar arquivo `.txt`. Também aceita upload de `.txt` como alternativa.

2. **Detecção automática de participantes** — O parser identifica os nomes e apresenta chips clicáveis: "Quem é o parceiro nesta conversa?" — ela só toca no nome.

3. **Progresso com empatia** — Enquanto analisa, frases como "Estamos lendo com cuidado...", "Identificando padrões...", "Quase lá..." com animação suave.

4. **Resultado como timeline visual** — Não mostra dados crus. Mostra uma linha do tempo da conversa com trechos destacados por cor de risco, e um resumo humanizado no topo.

### Implementação Técnica

#### 1. Database (migração)
- Tabela `whatsapp_imports` (id, user_id, contact_label, total_messages, total_chunks, analyzed_chunks, status, summary_json, created_at)
- RLS: acesso bloqueado direto (via edge function apenas)
- Coluna `import_id` nullable em `analysis_micro_results`

#### 2. Backend — `web-api` (3 novas actions)
- **`importWhatsApp`**: Recebe texto bruto + contact_label. Parser regex server-side para formato WhatsApp BR (`DD/MM/YYYY HH:MM - Nome: msg`). Divide em chunks de ~50 msgs. Cria registro + enfileira jobs MICRO.
- **`getWhatsAppImports`**: Lista imports com progresso.
- **`getWhatsAppImportDetail`**: Retorna import + análises vinculadas consolidadas.

#### 3. `analysis-worker` — adaptação mínima
- Quando payload tem `import_id` + `chat_text`: usa texto direto como transcrição, armazena com `import_id`, pula legacy `gravacoes_analises`.

#### 4. Frontend
- **Botão na tela de Gravações**: Card atrativo "Analisar conversa do WhatsApp" com ícone verde do MessageCircle.
- **Drawer fullscreen** (mobile) ou **Dialog** (desktop) com wizard de 3 passos:
  - Passo 1: Textarea grande + drag/drop `.txt` + mini tutorial visual (como exportar do WhatsApp)
  - Passo 2: Chips com nomes detectados para selecionar o parceiro
  - Passo 3: Progresso animado com frases empáticas
- **Tela de resultado**: Card na lista de gravações ou seção dedicada mostrando timeline de risco + resumo humanizado
- Reutiliza `AnaliseCard` para detalhes de cada chunk

#### 5. Arquivos criados/alterados

| Arquivo | Ação |
|---|---|
| migração SQL | Nova tabela + coluna |
| `web-api/index.ts` | 3 actions novas |
| `analysis-worker/index.ts` | Suporte a `import_id` |
| `src/components/whatsapp/WhatsAppImportWizard.tsx` | Wizard de 3 passos |
| `src/components/whatsapp/WhatsAppResultCard.tsx` | Card de resultado |
| `src/pages/Gravacoes.tsx` | Botão de acesso ao wizard |

### Fluxo da Usuária (resumo)

1. Abre Gravações → vê card "Importar conversa do WhatsApp"
2. Toca → abre wizard → cola ou arrasta o `.txt`
3. Sistema detecta nomes → ela toca no parceiro
4. Animação de análise com frases acolhedoras
5. Resultado: timeline visual com risco por trecho + resumo + orientações

