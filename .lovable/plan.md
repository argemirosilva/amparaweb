

# Expandir OCR para aceitar prints de qualquer mensageiro

## Situação atual
O wizard já suporta screenshots, mas o prompt do OCR (edge function `whatsapp-ocr`) está rigidamente focado em WhatsApp - exige formato "DD/MM/AAAA HH:MM - Nome: mensagem" e ignora elementos que não sejam desse formato.

## Estratégia proposta

### 1. Generalizar o prompt do OCR
Atualizar o system prompt da edge function `whatsapp-ocr` para:
- Aceitar prints de **qualquer aplicativo de mensagens** (WhatsApp, Instagram, Telegram, SMS, iMessage, etc.)
- Manter o formato de saída padronizado (DD/MM/AAAA HH:MM - Nome: mensagem) independente da origem
- Quando a data não estiver visível, usar placeholder
- Identificar automaticamente o tipo de app pelo visual do screenshot

### 2. Atualizar labels no wizard (UI)
No componente `WhatsAppImportWizard.tsx`:
- Trocar "Screenshots do WhatsApp" por "Screenshots de conversas"
- Ajustar textos auxiliares para indicar que aceita prints de qualquer app de mensagens
- Manter o botão de upload de imagens como está (já funciona)

### 3. Nenhuma mudança no pipeline de análise
O texto extraído pelo OCR já alimenta o mesmo fluxo `importWhatsApp` → `analysis-worker`. Como a saída do OCR será padronizada no mesmo formato, o restante da pipeline continua funcionando sem alteração.

## Arquivos alterados
- `supabase/functions/whatsapp-ocr/index.ts` - Generalizar o system prompt
- `src/components/whatsapp/WhatsAppImportWizard.tsx` - Atualizar labels da UI

## Escopo mínimo
Duas edições pontuais: prompt do OCR e textos do wizard. Sem mudança estrutural.

