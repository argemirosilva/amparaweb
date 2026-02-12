import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { Progress } from "@/components/ui/progress";
import { Mic, Square, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import lamejs from "lamejs";

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

async function audioBufferToMp3(audioBuffer: AudioBuffer): Promise<Blob> {
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const kbps = 128;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  const mp3Data: ArrayBuffer[] = [];
  const blockSize = 1152;

  // Get channel data as Int16
  const channelData: Int16Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    const floatData = audioBuffer.getChannelData(ch);
    const int16 = new Int16Array(floatData.length);
    for (let i = 0; i < floatData.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, Math.round(floatData[i] * 32767)));
    }
    channelData.push(int16);
  }

  const totalSamples = channelData[0].length;
  for (let i = 0; i < totalSamples; i += blockSize) {
    const left = channelData[0].subarray(i, i + blockSize);
    let mp3buf: Int8Array;
    if (channels === 2) {
      const right = channelData[1].subarray(i, i + blockSize);
      mp3buf = encoder.encodeBuffer(left, right);
    } else {
      mp3buf = encoder.encodeBuffer(left);
    }
    if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf).buffer);
  }

  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(new Uint8Array(end).buffer);

  return new Blob(mp3Data, { type: "audio/mpeg" });
}

async function blobToMp3(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const mp3Blob = await audioBufferToMp3(audioBuffer);
  await audioCtx.close();
  return mp3Blob;
}

interface AudioRecorderCardProps {
  onUploaded?: () => void;
}

export default function AudioRecorderCard({ onUploaded }: AudioRecorderCardProps) {
  const { sessionToken } = useAuth();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);

  const uploadBlob = async (blob: Blob, fileName: string, contentType: string, duration: number) => {
    if (!sessionToken) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await callWebApi("uploadGravacao", sessionToken, {
        file_base64: base64,
        file_name: fileName,
        content_type: contentType,
        duracao_segundos: duration,
      });

      if (res.ok) {
        toast.success("Gravação enviada com sucesso!");
        onUploaded?.();
      } else {
        toast.error(res.data?.error || "Erro ao enviar gravação");
      }
    } catch {
      toast.error("Erro ao enviar gravação");
    } finally {
      setUploading(false);
      setElapsed(0);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const webmBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const duration = elapsed;

        // Convert webm to mp3
        setConverting(true);
        try {
          const mp3Blob = await blobToMp3(webmBlob);
          setConverting(false);
          await uploadBlob(mp3Blob, "gravacao.mp3", "audio/mpeg", duration);
        } catch (err) {
          console.error("MP3 conversion error:", err);
          setConverting(false);
          toast.error("Erro ao converter áudio para MP3");
        }
      };

      mediaRecorder.start(1000);
      startTimeRef.current = Date.now();
      setRecording(true);
      setElapsed(0);

      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 50 MB");
      return;
    }
    if (!file.type.startsWith("audio/")) {
      toast.error("Selecione um arquivo de áudio válido");
      return;
    }

    let duration = 0;
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      duration = await new Promise<number>((resolve) => {
        audio.onloadedmetadata = () => {
          resolve(isFinite(audio.duration) ? audio.duration : 0);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
      });
    } catch { /* ignore */ }

    // Convert WAV to MP3
    const isWav = file.type === "audio/wav" || file.type === "audio/x-wav" || file.name.toLowerCase().endsWith(".wav");
    if (isWav) {
      setConverting(true);
      try {
        const mp3Blob = await blobToMp3(file);
        setConverting(false);
        const mp3Name = file.name.replace(/\.wav$/i, ".mp3");
        await uploadBlob(mp3Blob, mp3Name, "audio/mpeg", duration);
      } catch (err) {
        console.error("WAV to MP3 conversion error:", err);
        setConverting(false);
        toast.error("Erro ao converter WAV para MP3");
      }
    } else {
      await uploadBlob(file, file.name, file.type, duration);
    }

    e.target.value = "";
  };

  if (!sessionToken) return null;

  return (
    <div className="ampara-card p-4">
      <div className="flex items-center gap-3 flex-wrap">
        {recording ? (
          <button
            onClick={stopRecording}
            className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center shrink-0 hover:bg-destructive/90 transition-colors shadow-lg animate-pulse"
          >
            <Square className="w-5 h-5 text-destructive-foreground" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={uploading || converting}
            className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0 hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50"
          >
            <Mic className="w-5 h-5 text-primary-foreground" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {recording ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                </span>
                <span className="text-sm font-medium text-foreground">Gravando...</span>
                <span className="text-sm text-muted-foreground tabular-nums">{formatDuration(elapsed)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Toque no botão para parar e enviar</p>
            </div>
          ) : converting ? (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Convertendo para MP3...
              </span>
            </div>
          ) : uploading ? (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Enviando gravação...
              </span>
              <Progress value={undefined} className="h-1.5" />
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">Gravar ou enviar áudio</p>
              <p className="text-xs text-muted-foreground">Grave pelo microfone ou envie um arquivo de áudio</p>
            </div>
          )}
        </div>

        {!recording && !uploading && !converting && (
          <label className="cursor-pointer">
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar arquivo</span>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
