import { useState } from "react";
import { useCopomSession } from "@/hooks/useCopomSession";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Phone,
  PhoneOff,
  PhoneCall,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Radio,
  MapPin,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export default function CopomCallCard({ panicAlertId, testMode }: { panicAlertId?: string; testMode?: boolean }) {
  const { state, startSession, startTestSession, endSession } = useCopomSession();
  const [showLogs, setShowLogs] = useState(false);
  const [isCallingPhone, setIsCallingPhone] = useState(false);

  const statusConfig = {
    idle: { label: "Pronto", color: "bg-muted text-muted-foreground", icon: Phone },
    collecting: { label: "Coletando dados…", color: "bg-yellow-500/20 text-yellow-700", icon: Loader2 },
    connecting: { label: "Conectando ao COPOM…", color: "bg-blue-500/20 text-blue-700", icon: Loader2 },
    active: { label: "Chamada ativa", color: "bg-green-500/20 text-green-700", icon: Radio },
    ended: { label: "Chamada encerrada", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
    error: { label: "Erro", color: "bg-destructive/20 text-destructive", icon: AlertTriangle },
  };

  const current = statusConfig[state.status];
  const StatusIcon = current.icon;

  return (
    <div className="space-y-3">
      {/* Main Card */}
      <Card className="border-2 border-destructive/30">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-destructive" />
              <h3 className="text-sm font-bold text-foreground">Comunicação COPOM</h3>
            </div>
            <Badge variant="outline" className={`text-xs ${current.color}`}>
              <StatusIcon className={`w-3 h-3 mr-1 ${state.status === "collecting" || state.status === "connecting" ? "animate-spin" : ""}`} />
              {current.label}
            </Badge>
          </div>

          {/* Context info when active */}
          {state.context && (state.status === "active" || state.status === "ended") && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Protocolo:</span>
                <span className="font-mono text-foreground">{state.context.protocol_id}</span>
              </div>
              {state.context.location.address && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="text-foreground">{state.context.location.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Movimento:</span>
                <span className="text-foreground">{state.context.location.movement_status}</span>
                {state.context.location.speed_kmh !== null && (
                  <span className="text-foreground">({state.context.location.speed_kmh} km/h)</span>
                )}
              </div>
            </div>
          )}

          {/* Speaking indicator */}
          {state.status === "active" && (
            <div className="flex items-center gap-2 py-2">
              <div className={`w-3 h-3 rounded-full ${state.isSpeaking ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
              <span className="text-xs text-muted-foreground">
                {state.isSpeaking ? "Agente falando…" : "Aguardando…"}
              </span>
            </div>
          )}

          {/* Error message */}
          {state.error && (
            <div className="p-2 rounded-md bg-destructive/10 text-destructive text-xs">
              {state.error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {(state.status === "idle" || state.status === "error" || state.status === "ended") && (
              <>
                <Button
                  onClick={() => testMode ? startTestSession() : startSession(panicAlertId)}
                  variant="destructive"
                  size="sm"
                  className="flex-1 gap-2"
                >
                  <Phone className="w-4 h-4" />
                  {state.status === "ended" ? "Ligar novamente" : testMode ? "Iniciar teste" : "Iniciar comunicação"}
                </Button>
                {testMode && (
                  <Button
                    onClick={async () => {
                      setIsCallingPhone(true);
                      try {
                        const { data, error } = await supabase.functions.invoke("copom-outbound-call", {
                          body: { context: state.context },
                        });
                        if (error) throw error;
                        toast.success("Ligação telefônica iniciada!", {
                          description: `Chamando +5514997406686...`,
                        });
                      } catch (err: any) {
                        toast.error("Erro ao iniciar ligação", {
                          description: err?.message || String(err),
                        });
                      } finally {
                        setIsCallingPhone(false);
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="gap-2 border-green-600 text-green-700 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-950"
                    disabled={isCallingPhone}
                  >
                    {isCallingPhone ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                    Ligar telefone
                  </Button>
                )}
              </>
            )}
            {(state.status === "active" || state.status === "connecting") && (
              <Button
                onClick={endSession}
                variant="outline"
                size="sm"
                className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive/10"
              >
                <PhoneOff className="w-4 h-4" />
                Encerrar chamada
              </Button>
            )}
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground leading-tight">
            Comunicação assistida por IA. Nenhum dado sensível é compartilhado. 
            Dados de localização são enviados em tempo real para auxiliar no atendimento.
          </p>
        </CardContent>
      </Card>

      {/* Logs (collapsible) */}
      {state.logs.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <button
              onClick={() => setShowLogs((v) => !v)}
              className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="font-medium">Registro de auditoria ({state.logs.length})</span>
              {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showLogs && (
              <ScrollArea className="mt-2 max-h-48">
                <div className="space-y-1">
                  {state.logs.map((log, i) => (
                    <div key={i} className="text-[10px] font-mono text-muted-foreground leading-tight">
                      <span className="text-foreground/50">
                        {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                      </span>{" "}
                      <span className="text-foreground">{log.event}</span>
                      {log.data && (
                        <span className="text-muted-foreground/70">
                          {" "}
                          {JSON.stringify(log.data)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
