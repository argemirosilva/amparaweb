

# Corrigir Formato de Gravacao Manual via Web

## Problema Identificado

A gravacao manual pelo site falhou na transcricao com erro `Agreggar API error: 400`. O registro no banco mostra:
- Arquivo: `.webm` (gravacao `af787224`)
- Erro: `Erro na transcricao: Agreggar API error: 400`

A API de transcricao da Agreggar nao suporta o formato WebM. O navegador Chrome grava em `audio/webm;codecs=opus` (nao suporta `audio/ogg`), e o sistema envia esse WebM diretamente sem conversao.

Gravacoes anteriores que funcionaram eram todas `.mp3` (arquivos enviados via upload, nao gravados pelo microfone).

## Solucao

Converter SEMPRE o audio gravado pelo microfone para MP3 antes do upload, usando a funcao `blobToMp3()` que ja existe no componente `AudioRecorderCard.tsx`. O codigo de conversao WAV->MP3 ja esta implementado e funcionando.

## Alteracao

**Arquivo:** `src/components/dashboard/AudioRecorderCard.tsx`

Na funcao `mediaRecorder.onstop` (linha ~136), em vez de enviar o blob OGG/WebM diretamente, converter para MP3 primeiro:

```
Antes (atual):
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const isOgg = mimeType.startsWith("audio/ogg");
    const fileName = isOgg ? "gravacao.ogg" : "gravacao.webm";
    const contentType = isOgg ? "audio/ogg" : "audio/webm";
    await uploadBlob(blob, fileName, contentType, duration);
  };

Depois (corrigido):
  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const duration = elapsed;
    setConverting(true);
    try {
      const mp3Blob = await blobToMp3(blob);
      setConverting(false);
      await uploadBlob(mp3Blob, "gravacao.mp3", "audio/mpeg", duration);
    } catch (err) {
      console.error("Audio to MP3 conversion error:", err);
      setConverting(false);
      toast.error("Erro ao converter audio para MP3");
    }
  };
```

Isso garante que qualquer formato nativo do navegador (OGG, WebM) seja convertido para MP3 antes do envio, mantendo compatibilidade total com a API da Agreggar.

## Impacto

- Zero alteracao no backend ou na API mobile
- Usa a funcao `blobToMp3()` ja existente e testada
- Todos os navegadores passam a funcionar (Chrome, Firefox, Safari)
- Uploads de arquivo (.mp3, .wav, .ogg) continuam funcionando como antes

