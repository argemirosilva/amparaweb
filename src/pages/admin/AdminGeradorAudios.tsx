import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  Square,
  RotateCcw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Mic,
  AlertTriangle,
  User,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

interface JobItem {
  id: string;
  item_index: number;
  status: string;
  topic: string | null;
  duration_sec: number | null;
  tries: number;
  last_error: string | null;
  storage_url: string | null;
}

interface Job {
  id: string;
  status: string;
  total: number;
  done_count: number;
  failed_count: number;
  created_at: string;
}

async function callApi(
  action: string,
  sessionToken: string,
  params: Record<string, any> = {}
) {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/admin-audio-auto`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ action, session_token: sessionToken, ...params }),
    }
  );
  return res.json();
}

function formatDuration(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  queued: { label: "Na fila", variant: "secondary" },
  processing: { label: "Processando", variant: "default" },
  done: { label: "Concluído", variant: "outline" },
  failed: { label: "Falha", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "secondary" },
};

export default function AdminGeradorAudios() {
  const { sessionToken } = useAuth();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<JobItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [usuarios, setUsuarios] = useState<{ id: string; nome_completo: string; email: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [audioMode, setAudioMode] = useState<string>("violencia");
  const [batchSize, setBatchSize] = useState<string>("20");
  const cancelRef = useRef(false);
  const analyzeCancelRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load users for selector
  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase
        .from("usuarios")
        .select("id, nome_completo, email")
        .eq("status", "ativo")
        .order("nome_completo");
      if (data) {
        setUsuarios(data);
        // Auto-select first user
        if (data.length > 0 && !targetUserId) {
          setTargetUserId(data[0].id);
        }
      }
      setLoadingUsers(false);
    }
    loadUsers();
  }, []);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("pt-BR");
    setLogs((prev) => [...prev.slice(-199), `[${ts}] ${msg}`]);
  }, []);

  // Poll status
  const pollStatus = useCallback(
    async (jId: string) => {
      if (!sessionToken) return;
      const res = await callApi("getStatus", sessionToken, { job_id: jId });
      if (res.ok) {
        setJob(res.job);
        setItems(res.items || []);
      }
    },
    [sessionToken]
  );

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Poll while running
  useEffect(() => {
    if (!jobId || !isRunning) return;
    const interval = setInterval(() => pollStatus(jobId), 3000);
    return () => clearInterval(interval);
  }, [jobId, isRunning, pollStatus]);

  // Start generation
  const handleStart = async () => {
    if (!sessionToken || !targetUserId) return;
    setStarting(true);
    cancelRef.current = false;
    const selectedUser = usuarios.find(u => u.id === targetUserId);
    const modeLabel = audioMode === "briga_saudavel" ? "brigas saudáveis" : "violência doméstica";
    const count = parseInt(batchSize) || 20;
    addLog(`Iniciando geração de ${count} áudios (${modeLabel}) para ${selectedUser?.nome_completo || targetUserId}...`);

    try {
      const res = await callApi("start", sessionToken, { count, target_user_id: targetUserId, audio_mode: audioMode });
      if (!res.ok) {
        addLog(`❌ Erro ao criar job: ${res.error}`);
        setStarting(false);
        return;
      }

      const jId = res.job_id;
      setJobId(jId);
      addLog(`✅ Job criado: ${jId}`);
      setIsRunning(true);
      setStarting(false);

      await pollStatus(jId);

      // Processing loop
      let finished = false;
      while (!finished && !cancelRef.current) {
        const r = await callApi("processNext", sessionToken, { job_id: jId, target_user_id: targetUserId, audio_mode: audioMode });

        if (r.finished) {
          finished = true;
          addLog(`🏁 Job finalizado (status: ${r.status})`);
        } else if (r.result?.success) {
          addLog(
            `✅ #${r.item_index} — ${r.result.topic} — ${formatDuration(r.result.duration)}`
          );
        } else {
          addLog(`❌ #${r.item_index} falhou: ${r.result?.error || "erro desconhecido"}`);
        }

        // Refresh status
        await pollStatus(jId);
      }
    } catch (err: any) {
      addLog(`❌ Erro fatal: ${err.message}`);
    } finally {
      setIsRunning(false);
      setStarting(false);
    }
  };

  // Cancel
  const handleCancel = async () => {
    if (!sessionToken || !jobId) return;
    cancelRef.current = true;
    addLog("⏹ Cancelando...");
    await callApi("cancel", sessionToken, { job_id: jobId });
    await pollStatus(jobId);
    setIsRunning(false);
    addLog("⏹ Job cancelado.");
  };

  // Retry failed
  const handleRetry = async () => {
    if (!sessionToken || !jobId) return;
    cancelRef.current = false;
    addLog("🔄 Reprocessando falhas...");
    const res = await callApi("retryFailed", sessionToken, { job_id: jobId });
    addLog(`🔄 ${res.retried || 0} itens recolocados na fila.`);
    await pollStatus(jobId);

    // Resume processing
    setIsRunning(true);
    let finished = false;
    while (!finished && !cancelRef.current) {
      const r = await callApi("processNext", sessionToken, { job_id: jobId, target_user_id: targetUserId, audio_mode: audioMode });
      if (r.finished) {
        finished = true;
        addLog(`🏁 Reprocessamento concluído (status: ${r.status})`);
      } else if (r.result?.success) {
        addLog(`✅ #${r.item_index} — ${r.result.topic} — ${formatDuration(r.result.duration)}`);
      } else {
        addLog(`❌ #${r.item_index} falhou: ${r.result?.error || "erro desconhecido"}`);
      }
      await pollStatus(jobId);
    }
    setIsRunning(false);
  };

  // Batch analyze
  const handleBatchAnalyze = async () => {
    if (!sessionToken) return;
    setAnalyzing(true);
    analyzeCancelRef.current = false;
    addLog("🧠 Iniciando análise de risco em lote...");

    let totalAnalyzed = 0;
    let remaining = 1; // start loop

    while (remaining > 0 && !analyzeCancelRef.current) {
      try {
        const res = await callApi("batchAnalyze", sessionToken, { batch_size: 5 });
        if (!res.ok) {
          addLog(`❌ Erro: ${res.error}`);
          break;
        }
        totalAnalyzed += res.analyzed || 0;
        remaining = res.remaining || 0;
        addLog(`🧠 Analisadas: ${res.analyzed} | Restantes: ${remaining} | Total: ${totalAnalyzed}`);
        if (res.errors?.length) {
          res.errors.forEach((e: string) => addLog(`  ⚠️ ${e}`));
        }
      } catch (err: any) {
        addLog(`❌ Erro: ${err.message}`);
        break;
      }
    }

    addLog(`🏁 Análise concluída. ${totalAnalyzed} gravações analisadas.`);
    setAnalyzing(false);
  };

  const progress = job ? ((job.done_count + job.failed_count) / job.total) * 100 : 0;

  return (
    <div style={fontStyle}>
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>
          Admin &gt; Gerador de Áudios
        </p>
        <h1
          className="text-xl font-semibold"
          style={{ color: "hsl(220 13% 18%)" }}
        >
          Gerador Automático de Áudios (AMPARA)
        </h1>
        <p className="text-sm mt-1" style={{ color: "hsl(220 9% 46%)" }}>
          Gera automaticamente áudios de diálogo realistas para treinamento de
          detecção de violência doméstica.
        </p>
      </div>

      {/* User selector */}
      <Card className="mb-6" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <User className="w-5 h-5" style={{ color: "hsl(224 76% 33%)" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                Vincular gravações à usuária:
              </p>
            </div>
            <Select value={targetUserId} onValueChange={setTargetUserId} disabled={isRunning || loadingUsers}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder={loadingUsers ? "Carregando..." : "Selecione a usuária"} />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome_completo} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audio mode selector */}
      <Card className="mb-6" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Mic className="w-5 h-5" style={{ color: "hsl(224 76% 33%)" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                Tipo de áudio:
              </p>
            </div>
            <Select value={audioMode} onValueChange={setAudioMode} disabled={isRunning}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="violencia">🔴 Violência doméstica (controle/manipulação)</SelectItem>
                <SelectItem value="briga_saudavel">🟢 Briga saudável (discussão sem violência)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs mt-2 ml-8" style={{ color: "hsl(220 9% 46%)" }}>
            {audioMode === "briga_saudavel"
              ? "Gera discussões acaloradas porém saudáveis — sem controle, manipulação ou escalada de violência. Útil para treinar o sistema a distinguir brigas normais."
              : "Gera diálogos com padrões de abuso psicológico e controle coercitivo para treinamento de detecção."}
          </p>
        </CardContent>
      </Card>

      {/* Batch size + Controls */}
      <Card className="mb-6" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                Quantidade por lote:
              </p>
            </div>
            <Select value={batchSize} onValueChange={setBatchSize} disabled={isRunning}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          onClick={handleStart}
          disabled={isRunning || starting || !targetUserId}
          size="lg"
          className="gap-2"
          style={{
            background: "hsl(224 76% 33%)",
            color: "#fff",
          }}
        >
          {starting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          Gerar {batchSize} áudios agora
        </Button>

        {isRunning && (
          <Button
            onClick={handleCancel}
            variant="destructive"
            size="lg"
            className="gap-2"
          >
            <Square className="w-4 h-4" />
            Cancelar
          </Button>
        )}

        {job && !isRunning && (job.failed_count || 0) > 0 && (
          <Button
            onClick={handleRetry}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reprocessar falhas ({job.failed_count})
          </Button>
        )}

        <Button
          onClick={analyzing ? () => { analyzeCancelRef.current = true; } : handleBatchAnalyze}
          disabled={isRunning || starting}
          variant={analyzing ? "destructive" : "outline"}
          size="lg"
          className="gap-2"
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Parar Análise
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Analisar Gravações
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      {job && (
        <Card
          className="mb-6"
          style={{
            background: "hsl(0 0% 100%)",
            borderColor: "hsl(220 13% 91%)",
          }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-base"
              style={{ color: "hsl(220 13% 18%)" }}
            >
              Progresso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={progress} className="h-3 mb-3" />
            <div className="flex gap-6 text-sm">
              <span style={{ color: "hsl(220 9% 46%)" }}>
                <CheckCircle2
                  className="w-4 h-4 inline mr-1"
                  style={{ color: "hsl(142 71% 35%)" }}
                />
                {job.done_count} concluídos
              </span>
              {(job.failed_count || 0) > 0 && (
                <span style={{ color: "hsl(0 73% 42%)" }}>
                  <XCircle className="w-4 h-4 inline mr-1" />
                  {job.failed_count} falhas
                </span>
              )}
              <span style={{ color: "hsl(220 9% 46%)" }}>
                <Clock className="w-4 h-4 inline mr-1" />
                {job.total - job.done_count - (job.failed_count || 0)} restantes
              </span>
              <Badge
                variant={
                  job.status === "done"
                    ? "outline"
                    : job.status === "canceled"
                    ? "secondary"
                    : "default"
                }
              >
                {job.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Logs */}
        <Card
          style={{
            background: "hsl(0 0% 100%)",
            borderColor: "hsl(220 13% 91%)",
          }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-base flex items-center gap-2"
              style={{ color: "hsl(220 13% 18%)" }}
            >
              <Mic className="w-4 h-4" />
              Console
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div
                className="font-mono text-xs space-y-0.5 p-2 rounded"
                style={{
                  background: "hsl(220 13% 18%)",
                  color: "hsl(120 50% 75%)",
                }}
              >
                {logs.length === 0 && (
                  <p style={{ color: "hsl(220 9% 46%)" }}>
                    Aguardando início...
                  </p>
                )}
                {logs.map((log, i) => (
                  <p key={i}>{log}</p>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card
          style={{
            background: "hsl(0 0% 100%)",
            borderColor: "hsl(220 13% 91%)",
          }}
        >
          <CardHeader className="pb-3">
            <CardTitle
              className="text-base"
              style={{ color: "hsl(220 13% 18%)" }}
            >
              Itens ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Tema</TableHead>
                    <TableHead className="w-20">Duração</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-sm"
                        style={{ color: "hsl(220 9% 46%)" }}
                      >
                        Nenhum item ainda
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((item) => {
                    const sb = STATUS_BADGE[item.status] || {
                      label: item.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          {item.item_index}
                        </TableCell>
                        <TableCell
                          className="text-xs truncate max-w-[160px]"
                          title={item.topic || undefined}
                        >
                          {item.topic || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDuration(item.duration_sec)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sb.variant} className="text-xs">
                            {sb.label}
                          </Badge>
                          {item.last_error && (
                            <span title={item.last_error}>
                              <AlertTriangle
                                className="w-3 h-3 inline ml-1"
                                style={{ color: "hsl(0 73% 42%)" }}
                              />
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
