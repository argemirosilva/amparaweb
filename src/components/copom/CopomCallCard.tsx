import { useState, useEffect } from "react";
import { useCopomSession } from "@/hooks/useCopomSession";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const { usuario } = useAuth();
  const [showLogs, setShowLogs] = useState(false);
  const [isCallingPhone, setIsCallingPhone] = useState(false);
  const [testLinkCode, setTestLinkCode] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState(() => localStorage.getItem("copom_test_phone") || "+5514997406686");

  useEffect(() => {
    if (testMode) localStorage.setItem("copom_test_phone", testPhone);
  }, [testPhone, testMode]);

  const createTestTrackingLink = async () => {
    if (!usuario?.id) return null;
    const code = "a2jb3";
    try {
      // Check if already exists and is active
      const { data: existing } = await supabase
        .from("compartilhamento_gps")
        .select("id, codigo, expira_em")
        .eq("codigo", code)
        .eq("ativo", true)
        .maybeSingle();

      if (existing && new Date(existing.expira_em) > new Date()) {
        setTestLinkCode(code);
        return code;
      }

      // Create via mobile-api (uses service role, no admin auth needed)
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "createTestTrackingLink",
            user_id: usuario.id,
            codigo: code,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setTestLinkCode(code);
        return code;
      }
      console.error("Failed to create test link:", data);
      return null;
    } catch (err) {
      console.error("Error creating test tracking link:", err);
      return null;
    }
  };

  // Test context for display when in test mode and idle
  const testContext = testMode ? {
    type: "COPOM_ALERT_CONTEXT" as const,
    protocol_id: "AMP-TEST-PREVIEW",
    timestamp: new Date().toISOString(),
    risk_level: "ALTO",
    trigger_reason: "panico_manual",
    victim: { name: "Maria da Silva", internal_id: "test-user-001", phone_masked: "(14) ****-6686" },
    location: {
      address: "Rua José Gonçalves de Oliveira Filho, 67 - Residencial Estoril Premium, Bauru/SP",
      lat: -22.3154, lng: -49.0615, accuracy_m: 12,
      movement_status: "PARADA", speed_kmh: 0,
    },
    monitoring_link: `${window.location.origin}/a2jb3`,
    victim_aggressor_relation: "Ex-marido",
    aggressor: {
      name: "João Santos", name_masked: "J*** S***", description: "Ex-marido, ativo, risco: alto",
      vehicle: { model: "Onix", color: "Prata", plate_partial: "ABC1D23" },
      vehicle_note: "NAO_CONFIRMADO",
    },
    strict_rules: { never_invent_data: true, if_missing_say_unavailable: true, do_not_claim_certainty: true, privacy_first: true },
  } : null;

  const displayContext = state.context || testContext;

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

          {/* Context info - show when available */}
          {displayContext && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Protocolo:</span>
                <span className="font-mono text-foreground">{displayContext.protocol_id}</span>
              </div>
              {displayContext.monitoring_link && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <span className="font-medium">Link:</span>
                  <a href={displayContext.monitoring_link} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                    {displayContext.monitoring_link.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                </div>
              )}
              {displayContext.location.address && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  <span className="text-foreground">{displayContext.location.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Movimento:</span>
                <span className="text-foreground">{displayContext.location.movement_status}</span>
                {displayContext.location.speed_kmh !== null && (
                  <span className="text-foreground">({displayContext.location.speed_kmh} km/h)</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Vítima:</span>
                <span className="text-foreground">{displayContext.victim.name}</span>
              </div>
              {displayContext.victim.phone_masked && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Telefone:</span>
                  <span className="text-foreground">{displayContext.victim.phone_masked}</span>
                </div>
              )}
              {(displayContext as any).victim_aggressor_relation && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Relação:</span>
                  <span className="text-foreground">{(displayContext as any).victim_aggressor_relation}</span>
                </div>
              )}
              {displayContext.aggressor && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Agressor:</span>
                  <span className="text-foreground">{displayContext.aggressor.name_masked} — {displayContext.aggressor.description}</span>
                </div>
              )}
              {displayContext.aggressor?.vehicle && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium">Veículo:</span>
                  <span className="text-foreground">
                    {displayContext.aggressor.vehicle.model} {displayContext.aggressor.vehicle.color}, placa {displayContext.aggressor.vehicle.plate_partial}
                    {displayContext.aggressor.vehicle_note === "NAO_CONFIRMADO" && " (não confirmado)"}
                  </span>
                </div>
              )}
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

          {/* Test phone config */}
          {testMode && (state.status === "idle" || state.status === "error" || state.status === "ended") && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap font-medium">Tel. teste:</label>
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+5511999999999"
                className="h-8 text-xs font-mono"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {(state.status === "idle" || state.status === "error" || state.status === "ended") && (
              <>
                <Button
                  onClick={async () => {
                    if (testMode) {
                      await createTestTrackingLink();
                      startTestSession();
                    } else {
                      startSession(panicAlertId);
                    }
                  }}
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
                      await createTestTrackingLink();
                      try {
                        const { data, error } = await supabase.functions.invoke("copom-outbound-call", {
                          body: {
                            context: state.context || testContext,
                            user_id: usuario?.id,
                            skip_cooldown: testMode,
                            phone_number: testPhone,
                          },
                        });
                        if (error) {
                          // Check if it's a cooldown error (429)
                          const errorBody = typeof error === "object" && (error as any)?.context?.body
                            ? JSON.parse(await (error as any).context.body.text())
                            : null;
                          if (errorBody?.error === "cooldown_active") {
                            toast.warning("Cooldown ativo", {
                              description: errorBody.message,
                            });
                            return;
                          }
                          throw error;
                        }
                        toast.success("Ligação telefônica iniciada!", {
                          description: `Chamando ${testPhone}...`,
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
