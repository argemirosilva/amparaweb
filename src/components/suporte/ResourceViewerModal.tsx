import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ShieldOff, Clock, Volume2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { callSupportApi } from "@/services/supportApiService";

interface ResourceViewerModalProps {
  open: boolean;
  onClose: () => void;
  grant: any;
  sessionToken: string;
  onRevoke: (grantId: string) => void;
}

function GrantTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expirado"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span className="font-mono text-sm">{remaining}</span>;
}

export default function ResourceViewerModal({ open, onClose, grant, sessionToken, onRevoke }: ResourceViewerModalProps) {
  const [resourceData, setResourceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const request = grant?.request;
  const resourceType = request?.resource_type;
  const scope = request?.requested_scope;

  useEffect(() => {
    if (!open || !grant || !sessionToken) return;
    setLoading(true);
    setError("");
    setResourceData(null);
    setAudioUrl(null);

    callSupportApi("getResource", sessionToken, {
      grant_id: grant.id,
      resource_type: resourceType,
      resource_id: request.resource_id,
    }).then(({ ok, data }) => {
      if (ok) {
        setResourceData(data.resource);
        // If audio, fetch blob
        if (scope === "read_audio_stream" && data.resource?.storage_path) {
          fetchAudioBlob(data.resource.storage_path);
        }
      } else {
        setError(data.error || "Erro ao carregar recurso");
      }
      setLoading(false);
    });
  }, [open, grant?.id]);

  // Auto-close on grant expiry
  useEffect(() => {
    if (!open || !grant) return;
    const check = setInterval(() => {
      if (new Date(grant.expires_at) <= new Date()) {
        onClose();
      }
    }, 2000);
    return () => clearInterval(check);
  }, [open, grant]);

  const fetchAudioBlob = async (storagePath: string) => {
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/web-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ action: "proxyAudio", session_token: sessionToken, path: storagePath }),
      });
      if (res.ok) {
        const blob = await res.blob();
        setAudioUrl(URL.createObjectURL(blob));
      }
    } catch { /* silent */ }
  };

  // Cleanup blob URL
  useEffect(() => {
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [audioUrl]);

  const scopeLabel: Record<string, string> = {
    read_metadata: "Metadados",
    read_transcription: "Transcrição",
    read_audio_stream: "Áudio",
    read_analysis: "Análise",
    read_logs: "Logs",
  };

  const typeLabel: Record<string, string> = {
    recording: "Gravação",
    transcription: "Transcrição",
    analysis: "Análise",
    metadata: "Metadados",
    logs: "Logs",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Visualização: {typeLabel[resourceType] || resourceType}</span>
            <Badge variant="secondary">{scopeLabel[scope] || scope}</Badge>
            {grant && (
              <span className="flex items-center gap-1 text-orange-600 text-sm font-normal">
                <Clock className="w-3.5 h-3.5" />
                <GrantTimer expiresAt={grant.expires_at} />
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando recurso...
            </div>
          )}
          {error && <p className="text-destructive text-sm py-4">{error}</p>}
          {!loading && !error && resourceData && (
            <>
              {/* Metadata view */}
              {(scope === "read_metadata") && <MetadataView data={resourceData} />}

              {/* Transcription view */}
              {(scope === "read_transcription") && <TranscriptionView data={resourceData} />}

              {/* Analysis view */}
              {(scope === "read_analysis") && <AnalysisView data={resourceData} />}

              {/* Logs view */}
              {(scope === "read_logs") && <LogsView data={resourceData} />}

              {/* Audio view */}
              {(scope === "read_audio_stream") && (
                <AudioView audioUrl={audioUrl} audioRef={audioRef} />
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button
            variant="destructive"
            className="gap-1"
            onClick={() => { onRevoke(grant.id); onClose(); }}
          >
            <ShieldOff className="w-4 h-4" /> Revogar Acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetadataView({ data }: { data: any }) {
  const rows = [
    ["Data", data.created_at ? format(new Date(data.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"],
    ["Duração", data.duracao_segundos ? `${Math.round(data.duracao_segundos)}s` : "-"],
    ["Tamanho", data.tamanho_mb ? `${data.tamanho_mb.toFixed(2)} MB` : "-"],
    ["Status", data.status || "-"],
    ["Dispositivo", data.device_id || "-"],
    ["Timezone", data.timezone || "-"],
  ];
  return (
    <Table>
      <TableBody>
        {rows.map(([label, value]) => (
          <TableRow key={label}>
            <TableCell className="font-medium w-36">{label}</TableCell>
            <TableCell>{value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TranscriptionView({ data }: { data: any }) {
  return (
    <div
      className="rounded-lg border p-4 text-sm whitespace-pre-wrap leading-relaxed"
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      {data.transcricao || <span className="text-muted-foreground italic">Sem transcrição disponível.</span>}
    </div>
  );
}

function AnalysisView({ data }: { data: any }) {
  const riskColors: Record<string, string> = {
    critico: "destructive",
    alto: "destructive",
    moderado: "secondary",
    baixo: "outline",
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {data.nivel_risco && (
          <Badge variant={(riskColors[data.nivel_risco] as any) || "secondary"}>
            Risco: {data.nivel_risco}
          </Badge>
        )}
        {data.sentimento && <Badge variant="outline">Sentimento: {data.sentimento}</Badge>}
      </div>
      {data.resumo && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Resumo</p>
          <p className="text-sm" style={{ userSelect: "none" }}>{data.resumo}</p>
        </div>
      )}
      {data.categorias?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Categorias</p>
          <div className="flex gap-1 flex-wrap">
            {data.categorias.map((c: string) => <Badge key={c} variant="outline">{c}</Badge>)}
          </div>
        </div>
      )}
      {data.palavras_chave?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Palavras-chave</p>
          <div className="flex gap-1 flex-wrap">
            {data.palavras_chave.map((k: string) => <Badge key={k} variant="secondary">{k}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

function LogsView({ data }: { data: any }) {
  const logs = Array.isArray(data) ? data : [];
  if (logs.length === 0) return <p className="text-sm text-muted-foreground py-4">Nenhum log encontrado.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Último Ping</TableHead>
            <TableHead>Bateria</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Versão</TableHead>
            <TableHead>Dispositivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((l: any) => (
            <TableRow key={l.id}>
              <TableCell className="text-xs">
                {l.last_ping_at ? format(new Date(l.last_ping_at), "dd/MM HH:mm", { locale: ptBR }) : "-"}
              </TableCell>
              <TableCell className="text-xs">{l.bateria_percentual != null ? `${l.bateria_percentual}%` : "-"}</TableCell>
              <TableCell className="text-xs">{l.status}</TableCell>
              <TableCell className="text-xs">{l.versao_app || "-"}</TableCell>
              <TableCell className="text-xs">{l.dispositivo_info || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AudioView({ audioUrl, audioRef }: { audioUrl: string | null; audioRef: React.RefObject<HTMLAudioElement> }) {
  if (!audioUrl) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando áudio...
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <Volume2 className="w-10 h-10 text-primary" />
      <audio ref={audioRef} controls src={audioUrl} className="w-full max-w-md" />
      <p className="text-xs text-muted-foreground">Reprodução temporária — acesso auditado.</p>
    </div>
  );
}
