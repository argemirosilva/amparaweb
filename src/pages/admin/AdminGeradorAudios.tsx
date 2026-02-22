import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
  Shuffle,
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
  const [batchSize, setBatchSize] = useState<string>("100");
  const randomMode = true;
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

  const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const AUDIO_MODES = ["violencia", "briga_saudavel"];

  // Start generation
  const handleStart = async () => {
    if (!sessionToken) return;
    if (!randomMode && !targetUserId) return;
    setStarting(true);
    cancelRef.current = false;
    const count = parseInt(batchSize) || 20;

    const initialUserId = randomMode ? usuarios[0]?.id : targetUserId;
    const initialMode = randomMode ? "violencia" : audioMode;

    if (randomMode) {
      addLog(`🎲 Iniciando geração ALEATÓRIA de ${count} áudios (usuárias e tipos aleatórios)...`);
    } else {
      const selectedUser = usuarios.find(u => u.id === targetUserId);
      const modeLabel = audioMode === "briga_saudavel" ? "brigas saudáveis" : "violência doméstica";
      addLog(`Iniciando geração de ${count} áudios (${modeLabel}) para ${selectedUser?.nome_completo || targetUserId}...`);
    }

    try {
      const res = await callApi("start", sessionToken, { count, target_user_id: initialUserId, audio_mode: initialMode });
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
        const itemUserId = randomMode ? pickRandom(usuarios).id : targetUserId;
        const itemMode = randomMode ? pickRandom(AUDIO_MODES) : audioMode;
        const userName = usuarios.find(u => u.id === itemUserId)?.nome_completo || "";

        const r = await callApi("processNext", sessionToken, { job_id: jId, target_user_id: itemUserId, audio_mode: itemMode });

        if (r.finished) {
          finished = true;
          addLog(`🏁 Job finalizado (status: ${r.status})`);
        } else if (r.result?.success) {
          const modeEmoji = itemMode === "briga_saudavel" ? "🟢" : "🔴";
          const userLabel = randomMode ? ` → ${userName}` : "";
          addLog(
            `✅ #${r.item_index} ${modeEmoji} ${r.result.topic} — ${formatDuration(r.result.duration)}${userLabel}`
          );
        } else {
          addLog(`❌ #${r.item_index} falhou: ${r.result?.error || "erro desconhecido"}`);
        }

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
      const itemUserId = randomMode ? pickRandom(usuarios).id : targetUserId;
      const itemMode = randomMode ? pickRandom(AUDIO_MODES) : audioMode;
      const r = await callApi("processNext", sessionToken, { job_id: jobId, target_user_id: itemUserId, audio_mode: itemMode });
      if (r.finished) {
        finished = true;
        addLog(`🏁 Reprocessamento concluído (status: ${r.status})`);
      } else if (r.result?.success) {
        const userName = usuarios.find(u => u.id === itemUserId)?.nome_completo || "";
        const modeEmoji = itemMode === "briga_saudavel" ? "🟢" : "🔴";
        addLog(`✅ #${r.item_index} ${modeEmoji} ${r.result.topic} — ${formatDuration(r.result.duration)}${randomMode ? ` → ${userName}` : ""}`);
      } else {
        addLog(`❌ #${r.item_index} falhou: ${r.result?.error || "erro desconhecido"}`);
      }
      await pollStatus(jobId);
    }
    setIsRunning(false);
  };

  // Batch analyze with detailed logs and stall monitoring
  const handleBatchAnalyze = async () => {
    if (!sessionToken) return;
    setAnalyzing(true);
    analyzeCancelRef.current = false;
    
    const BATCH_SIZE = 10;
    const MAX_CONSECUTIVE_ERRORS = 5;
    const STALL_TIMEOUT_MS = 90_000; // 90s without progress = stall
    
    addLog("🧠 ═══════════════════════════════════════════");
    addLog("🧠 ANÁLISE EM LOTE — INICIANDO");
    addLog(`🧠 Batch size: ${BATCH_SIZE} | Timeout stall: ${STALL_TIMEOUT_MS / 1000}s`);
    addLog("🧠 ═══════════════════════════════════════════");

    let totalAnalyzed = 0;
    let totalErrors = 0;
    let consecutiveErrors = 0;
    let batchNumber = 0;
    let remaining = 1;
    let lastProgressAt = Date.now();
    const startedAt = Date.now();

    while (remaining > 0 && !analyzeCancelRef.current) {
      batchNumber++;
      const batchStartTime = Date.now();

      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/run-batch-analysis`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
            },
            body: JSON.stringify({ batch_size: BATCH_SIZE, auto_chain: false }),
          }
        );

        if (!res.ok) {
          consecutiveErrors++;
          totalErrors++;
          addLog(`❌ Lote #${batchNumber}: HTTP ${res.status} — ${res.statusText}`);
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            addLog(`🛑 ${MAX_CONSECUTIVE_ERRORS} erros consecutivos. Parando.`);
            break;
          }
          addLog(`⏳ Aguardando 5s antes de retentativa... (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`);
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const data = await res.json();

        if (!data.ok) {
          consecutiveErrors++;
          totalErrors++;
          addLog(`❌ Lote #${batchNumber}: ${data.message || "erro desconhecido"}`);
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            addLog(`🛑 ${MAX_CONSECUTIVE_ERRORS} erros consecutivos. Parando.`);
            break;
          }
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }

        const analyzed = data.analyzed || 0;
        remaining = data.remaining || 0;
        totalAnalyzed += analyzed;
        const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
        const elapsed = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);

        if (analyzed > 0) {
          consecutiveErrors = 0;
          lastProgressAt = Date.now();
          const rate = (totalAnalyzed / ((Date.now() - startedAt) / 1000) * 60).toFixed(0);
          const eta = remaining > 0 ? (remaining / (totalAnalyzed / ((Date.now() - startedAt) / 1000)) / 60).toFixed(0) : "0";
          addLog(`✅ Lote #${batchNumber}: +${analyzed} analisadas em ${batchDuration}s | Restam: ${remaining} | Total: ${totalAnalyzed} | ${rate}/min | ETA: ~${eta}min | Tempo: ${elapsed}min`);
        } else {
          addLog(`⚠️ Lote #${batchNumber}: 0 analisadas (${batchDuration}s). Restam: ${remaining}`);
          // Check stall
          if (Date.now() - lastProgressAt > STALL_TIMEOUT_MS) {
            addLog(`🔄 STALL DETECTADO — sem progresso há ${((Date.now() - lastProgressAt) / 1000).toFixed(0)}s. Retentando...`);
            await new Promise(r => setTimeout(r, 3000));
          }
        }

        if (data.errors?.length) {
          totalErrors += data.errors.length;
          data.errors.forEach((e: string) => addLog(`  ⚠️ ${e}`));
        }

        // Small delay to not hammer the function
        if (remaining > 0 && !analyzeCancelRef.current) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (err: any) {
        consecutiveErrors++;
        totalErrors++;
        addLog(`❌ Lote #${batchNumber}: Exceção — ${err.message}`);
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          addLog(`🛑 ${MAX_CONSECUTIVE_ERRORS} erros consecutivos. Parando.`);
          break;
        }
        addLog(`⏳ Aguardando 5s antes de retentativa...`);
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    const totalTime = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
    addLog("🧠 ═══════════════════════════════════════════");
    addLog(`🏁 ANÁLISE CONCLUÍDA`);
    addLog(`   ✅ Total analisadas: ${totalAnalyzed}`);
    addLog(`   ❌ Total erros: ${totalErrors}`);
    addLog(`   ⏱️ Tempo total: ${totalTime} minutos`);
    addLog(`   📦 Lotes processados: ${batchNumber}`);
    if (analyzeCancelRef.current) addLog(`   ⏹ Cancelado pelo usuário`);
    addLog("🧠 ═══════════════════════════════════════════");
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

      {/* Random mode info */}
      <Card className="mb-6" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <Shuffle className="w-5 h-5" style={{ color: "hsl(224 76% 33%)" }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "hsl(220 13% 18%)" }}>
                Geração 100% Aleatória
              </p>
              <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                Distribui áudios entre todas as {usuarios.length} usuárias ativas, alterna tipos (violência / briga saudável), e gera datas aleatórias nos últimos 12 meses.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batch size */}
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
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 mb-6">
        <Button
          onClick={handleStart}
          disabled={isRunning || starting || (!randomMode && !targetUserId)}
          size="lg"
          className="gap-2"
          style={{
            background: "hsl(224 76% 33%)",
            color: "#fff",
          }}
        >
          {starting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : randomMode ? (
            <Shuffle className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {randomMode ? `🎲 Gerar ${batchSize} aleatórios` : `Gerar ${batchSize} áudios agora`}
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
