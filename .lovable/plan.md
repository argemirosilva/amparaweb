
# Integração WhatsApp - Notificações Condicionais por Nível de Risco

## Resumo

Criar uma edge function dedicada (`send-whatsapp`) e integrar envio de mensagens WhatsApp em **3 cenários distintos**, todos condicionados às configurações do usuário em `configuracao_alertas.acionamentos`:

1. **Pânico acionado** -- envia template `ampara2` aos guardiões (se habilitado)
2. **Análise de gravação detecta risco alto (grave) ou crítico** -- envia template `ampara2` aos guardiões (se habilitado para o nível correspondente)
3. **Login com senha de coação** -- envia notificação aos guardiões (se habilitado)
4. **Cancelamento de pânico** -- envia template `amparasafe` aos guardiões

---

## Regras de Envio (baseadas nas configurações)

```text
configuracao_alertas.acionamentos:
  whatsapp_guardioes:
    grave: true/false    --> envia quando nivel_risco = "alto"
    critico: true/false  --> envia quando nivel_risco = "critico" OU pânico
  autoridades_190_180:
    critico: true/false  --> acionar autoridades (futuro)
  senha_coacao:
    notificar_guardioes: true/false --> envia quando login por coação
```

| Evento | Condição no config | Template | Destinatários |
|--------|--------------------|----------|---------------|
| Pânico acionado | `whatsapp_guardioes.critico` | `ampara2` | Guardiões |
| Análise nivel_risco = "alto" | `whatsapp_guardioes.grave` | `ampara2` | Guardiões |
| Análise nivel_risco = "critico" | `whatsapp_guardioes.critico` | `ampara2` | Guardiões |
| Login senha de coação | `senha_coacao.notificar_guardioes` | `ampara2` | Guardiões |
| Cancelamento pânico | Sempre (se houve envio) | `amparasafe` | Guardiões |

---

## Templates e Parâmetros

### Template `ampara2` (Alerta)
| # | Parâmetro | Origem |
|---|-----------|--------|
| 1 | Nome da vítima | `usuarios.nome_completo` |
| 2 | Nome do agressor | `agressores.nome` (via `vitimas_agressores`) |
| 3 | Minutos (15, 30 ou 60) | `usuarios.gps_duracao_minutos` |
| 4 | Link da página temporária | URL completa: `https://ampamamulher.lovable.app/r/{codigo}` |
| 5 | Endereço resolvido | Reverse geocode. Se distância <= 50m do cadastrado: "Em casa" |

### Template `amparasafe` (Fim do Alerta)
| # | Parâmetro | Origem |
|---|-----------|--------|
| 1 | Nome do guardião | `guardioes.nome` |
| 2 | Nome da vítima | `usuarios.nome_completo` |

---

## Plano de Implementação

### 1. Migração de banco

Adicionar coordenadas do endereço cadastrado para cálculo de proximidade:

```sql
ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS endereco_lat double precision,
  ADD COLUMN IF NOT EXISTS endereco_lon double precision;
```

### 2. Criar edge function `send-whatsapp`

Função utilitária que:
- Recebe: `template_name`, `phone_number`, `parameters[]`
- Faz POST para `https://graph.facebook.com/v21.0/{PHONE_ID}/messages`
- Usa secrets: `META_WHATSAPP_TOKEN`, `META_WHATSAPP_PHONE_ID`
- Retorna sucesso/erro
- Formata telefone com DDI 55 se necessário

### 3. Criar módulo auxiliar de notificação dentro de `send-whatsapp`

Função de alto nível `notifyGuardiansAlert` que:
1. Busca dados da vítima (nome, endereço, gps_duracao_minutos, configuracao_alertas)
2. **Verifica se o envio está habilitado** para o nível de risco correspondente
3. Se desabilitado, retorna sem enviar
4. Busca guardiões da vítima
5. Busca agressor vinculado (primeiro ativo)
6. Faz reverse geocode (Nominatim, timeout 3s, fallback coordenadas)
7. Calcula distância Haversine -- se <= 50m do endereço cadastrado, usa "Em casa"
8. Cria link de compartilhamento GPS
9. Envia template `ampara2` para cada guardião

Função `notifyGuardiansResolved` que:
1. Busca guardiões
2. Envia template `amparasafe` (nome_guardiao, nome_vitima) para cada um

### 4. Integrar na `mobile-api` -- Pânico

No `handleAcionarPanico`, após criar o alerta:
- Chamar `send-whatsapp` internamente (via fetch ao próprio edge function) passando `user_id`, `tipo: "panico"`, `lat/lon`
- Fire-and-forget (não bloqueia resposta ao app)

No `handleCancelarPanico`, após cancelar:
- Chamar `send-whatsapp` com tipo `resolved`

### 5. Integrar na `process-recording` -- Alertas Grave/Crítico

Após salvar a análise (passo 7 atual, linha ~292), se `nivel_risco` for `"alto"` ou `"critico"`:
- Chamar `send-whatsapp` internamente passando `user_id`, `tipo: nivel_risco`, e coordenadas da última localização conhecida
- A função `send-whatsapp` verificará `configuracao_alertas` antes de enviar

### 6. Integrar na `mobile-api` -- Login por Coação

No `loginCustomizado`, quando `loginTipo === "coacao"` (linha ~173):
- Chamar `send-whatsapp` com `tipo: "coacao"`, usando última localização conhecida do dispositivo
- Verificação de `senha_coacao.notificar_guardioes` feita dentro do `send-whatsapp`

---

## Detalhes Técnicos

### Verificação de configuração (dentro do send-whatsapp)

```text
tipo "panico" ou "critico" --> checar whatsapp_guardioes.critico
tipo "alto" (grave)        --> checar whatsapp_guardioes.grave
tipo "coacao"              --> checar senha_coacao.notificar_guardioes
```

### Localização para alertas de gravação

Quando o trigger vem do `process-recording`, não há lat/lon no momento. Solução:
- Buscar a última localização do usuário na tabela `localizacoes` (ORDER BY created_at DESC LIMIT 1)
- Se não houver localização recente, enviar sem link de mapa e sem endereço

### Formato do telefone

Garantir formato `55XXXXXXXXXXX` (sem +, sem espaços). Se o telefone do guardião já tiver 11 dígitos, prefixar com `55`.

### Fire-and-forget

Todas as chamadas WhatsApp são assíncronas. Usar `fetch()` sem `await` ou `Promise.allSettled` para não atrasar respostas. Erros são logados em `audit_logs`.

### Config.toml

Adicionar entrada para a nova função:
```toml
[functions.send-whatsapp]
verify_jwt = false
```

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/send-whatsapp/index.ts` | Criar |
| `supabase/functions/mobile-api/index.ts` | Modificar (pânico + coação) |
| `supabase/functions/process-recording/index.ts` | Modificar (alerta grave/crítico) |
| Migração SQL | `endereco_lat`, `endereco_lon` em `usuarios` |
