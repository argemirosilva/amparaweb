

## Ouvir o Panorama com Google Cloud TTS

Adicionar um botao de audio no card "Como estou?" (MacroReportCard) que converte o texto do panorama narrativo em fala usando o Google Cloud Text-to-Speech.

### O que muda para voce

- Um botao com icone de alto-falante aparece ao lado do titulo "Panorama" dentro do card "Como estou?"
- Ao tocar, o texto e enviado para o Google e retorna como audio, tocando automaticamente
- Enquanto carrega, o botao mostra um spinner; enquanto toca, mostra icone de "parar"
- Tocar novamente para o audio

### Plano tecnico

**1. Nova Edge Function `tts-panorama`**
- Arquivo: `supabase/functions/tts-panorama/index.ts`
- Recebe `{ text, session_token }` via POST
- Valida sessao (reutiliza logica de hash de token existente)
- Usa as credenciais GCP ja configuradas (`GCP_PROJECT_ID`, `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY`) para gerar JWT e autenticar com a API do Google Cloud
- Chama `https://texttospeech.googleapis.com/v1/text:synthesize` com voz `pt-BR-Wavenet-A` (feminina, natural)
- Retorna o audio base64 como `application/json` com o campo `audioContent`
- CORS configurado para chamadas web

**2. Atualizar `supabase/config.toml`** (nao editavel diretamente, sera incluido automaticamente com o deploy)
- Adicionar entrada `[functions.tts-panorama]` com `verify_jwt = false`

**3. Atualizar `MacroReportCard.tsx`**
- Adicionar botao com icone `Volume2` (lucide) ao lado do titulo "Panorama"
- Estados: idle, loading, playing
- Ao clicar:
  - Chama a edge function `tts-panorama` passando o texto do panorama e o `sessionToken`
  - Decodifica o base64 retornado em um `AudioBuffer` ou usa `new Audio()` com data URI
  - Reproduz o audio
- Ao clicar novamente ou ao terminar: para a reproducao
- Icones: `Volume2` (idle), `Loader2` (loading), `VolumeX` (playing/parar)

### Fluxo

```text
Usuaria toca no botao de audio
       |
       v
Frontend POST -> tts-panorama edge function
       |
       v
Edge function autentica sessao
       |
       v
Edge function gera JWT GCP -> chama Google TTS API
       |
       v
Retorna audioContent (base64 MP3)
       |
       v
Frontend decodifica e reproduz
```

### Arquivos envolvidos

| Arquivo | Acao |
|---|---|
| `supabase/functions/tts-panorama/index.ts` | Criar |
| `src/components/gravacoes/MacroReportCard.tsx` | Editar - adicionar botao TTS |

