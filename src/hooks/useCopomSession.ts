/**
 * AMPARA COPOM ElevenLabs Session Hook
 * Manages the full lifecycle of a COPOM emergency voice call via ElevenLabs Agent.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  collectCopomData,
  collectCopomLocationUpdate,
  type CopomContextPayload,
  type CopomUpdatePayload,
} from "@/services/copomDataService";

const AGENT_ID = "agent_5901khfc47ksfg0ay6h66vxrz0j3";
const LOCATION_UPDATE_INTERVAL = 20_000; // 20s
const DISTANCE_THRESHOLD_M = 100;

interface CopomLog {
  timestamp: string;
  event: string;
  data?: any;
}

export interface CopomSessionState {
  status: "idle" | "collecting" | "connecting" | "active" | "ended" | "error";
  error: string | null;
  protocolId: string | null;
  context: CopomContextPayload | null;
  logs: CopomLog[];
  isSpeaking: boolean;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
  lastLocationSent: { lat: number; lng: number } | null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useCopomSession() {
  const { usuario } = useAuth();
  const [state, setState] = useState<CopomSessionState>({
    status: "idle",
    error: null,
    protocolId: null,
    context: null,
    logs: [],
    isSpeaking: false,
    sessionStartedAt: null,
    sessionEndedAt: null,
    lastLocationSent: null,
  });

  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMovementRef = useRef<string | null>(null);

  const addLog = useCallback((event: string, data?: any) => {
    setState((s) => ({
      ...s,
      logs: [...s.logs, { timestamp: new Date().toISOString(), event, data }],
    }));
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      addLog("SESSION_CONNECTED");
      setState((s) => ({ ...s, status: "active", sessionStartedAt: new Date().toISOString() }));
    },
    onDisconnect: () => {
      addLog("SESSION_DISCONNECTED");
      setState((s) => ({
        ...s,
        status: "ended",
        sessionEndedAt: new Date().toISOString(),
      }));
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    },
    onError: (error) => {
      addLog("SESSION_ERROR", { error: String(error) });
      setState((s) => ({ ...s, status: "error", error: String(error) }));
    },
    onMessage: (message) => {
      addLog("AGENT_MESSAGE", { type: (message as any).type });
    },
  });

  // Sync isSpeaking
  useEffect(() => {
    setState((s) => ({ ...s, isSpeaking: conversation.isSpeaking }));
  }, [conversation.isSpeaking]);

  // Internal: connect to ElevenLabs and send context
  const connectAndSend = useCallback(
    async (ctx: CopomContextPayload) => {
      setState((s) => ({
        ...s,
        context: ctx,
        protocolId: ctx.protocol_id,
        status: "connecting",
      }));

      // Request microphone
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        addLog("MICROPHONE_GRANTED");
      } catch {
        addLog("MICROPHONE_DENIED");
        setState((s) => ({
          ...s,
          status: "error",
          error: "Permissão de microfone negada. Habilite o microfone para continuar.",
        }));
        return;
      }

      // Start ElevenLabs session
      try {
        await conversation.startSession({
          agentId: AGENT_ID,
          connectionType: "webrtc",
        });
        addLog("ELEVENLABS_SESSION_STARTED");
      } catch (err) {
        addLog("ELEVENLABS_SESSION_FAILED", { error: String(err) });
        setState((s) => ({
          ...s,
          status: "error",
          error: "Falha ao conectar com o agente de voz. Tente novamente.",
        }));
        return;
      }

      // Send context
      conversation.sendContextualUpdate(JSON.stringify(ctx));
      addLog("CONTEXT_SENT", { payload_size: JSON.stringify(ctx).length });

      // Trigger the agent
      const triggerMessage =
        "Iniciar comunicado de urgência ao COPOM usando SOMENTE o contexto COPOM_ALERT_CONTEXT. " +
        "NUNCA invente dados. Se faltar algo, diga: 'essa informação não está disponível no sistema neste momento'. " +
        "Não afirmar certeza. Se movement_status for VEICULO e houver dados de vehicle, cite como NAO_CONFIRMADO.";

      conversation.sendUserMessage(triggerMessage);
      addLog("TRIGGER_MESSAGE_SENT");

      setState((s) => ({
        ...s,
        lastLocationSent: ctx.location.lat && ctx.location.lng
          ? { lat: ctx.location.lat, lng: ctx.location.lng }
          : null,
      }));
      lastMovementRef.current = ctx.location.movement_status;
    },
    [conversation, addLog]
  );

  // Start the COPOM session (real data)
  const startSession = useCallback(
    async (panicAlertId?: string) => {
      if (!usuario) {
        setState((s) => ({ ...s, status: "error", error: "Usuária não autenticada" }));
        return;
      }

      setState((s) => ({ ...s, status: "collecting", error: null, logs: [] }));
      addLog("DATA_COLLECTION_START");

      const result = await collectCopomData(usuario.id, panicAlertId);

      if (!result.valid || !result.context) {
        addLog("VALIDATION_FAILED", { errors: result.errors });
        setState((s) => ({
          ...s,
          status: "error",
          error: `ABORTADO: dados mínimos ausentes - ${result.errors.join(", ")}`,
        }));
        return;
      }

      const ctx = result.context;
      addLog("DATA_COLLECTED", { protocol_id: ctx.protocol_id, risk_level: ctx.risk_level });

      await connectAndSend(ctx);

      // Start real-time location updates
      updateIntervalRef.current = setInterval(async () => {
        if (!usuario || !ctx.protocol_id) return;

        const update = await collectCopomLocationUpdate(usuario.id, ctx.protocol_id);
        if (!update || update.location.lat === null || update.location.lng === null) return;

        setState((prev) => {
          const last = prev.lastLocationSent;
          const movementChanged = update.location.movement_status !== lastMovementRef.current;
          const distanceMoved =
            last && update.location.lat !== null && update.location.lng !== null
              ? haversineMeters(last.lat, last.lng, update.location.lat!, update.location.lng!)
              : Infinity;

          if (distanceMoved > DISTANCE_THRESHOLD_M || movementChanged) {
            conversation.sendContextualUpdate(JSON.stringify(update));
            addLog("LOCATION_UPDATE_SENT", {
              distance_m: Math.round(distanceMoved),
              movement_changed: movementChanged,
            });
            lastMovementRef.current = update.location.movement_status;
            return {
              ...prev,
              lastLocationSent: { lat: update.location.lat!, lng: update.location.lng! },
            };
          }
          return prev;
        });
      }, LOCATION_UPDATE_INTERVAL);
    },
    [usuario, conversation, addLog, connectAndSend]
  );

  // Start test session with hardcoded data
  const startTestSession = useCallback(async () => {
    setState((s) => ({ ...s, status: "collecting", error: null, logs: [] }));
    addLog("TEST_MODE_START");

    const testContext: CopomContextPayload = {
      type: "COPOM_ALERT_CONTEXT",
      protocol_id: `AMP-TEST-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      risk_level: "ALTO",
      trigger_reason: "panico_manual",
      victim: {
        name: "Maria da Silva",
        internal_id: "test-user-001",
        phone_masked: "(14) ****-6686",
      },
      location: {
        address: "Rua José Gonçalves de Oliveira Filho, 67 - Residencial Estoril Premium",
        lat: -22.3154,
        lng: -49.0615,
        accuracy_m: 12,
        movement_status: "PARADA",
        speed_kmh: 0,
      },
      monitoring_link: "https://amparamulher.com.br/a2jb3",
      victim_aggressor_relation: "Ex-marido",
      aggressor: {
        name: "João Santos",
        name_masked: "J*** S***",
        vehicle: {
          model: "Onix",
          color: "Prata",
          plate_partial: "ABC1D23",
        },
        vehicle_note: "NAO_CONFIRMADO",
      },
      strict_rules: {
        never_invent_data: true,
        if_missing_say_unavailable: true,
        do_not_claim_certainty: true,
        privacy_first: true,
      },
    };

    addLog("TEST_DATA_GENERATED", { protocol_id: testContext.protocol_id });

    await connectAndSend(testContext);
  }, [addLog, connectAndSend]);

  // End the session
  const endSession = useCallback(async () => {
    addLog("SESSION_END_REQUESTED");
    try {
      await conversation.endSession();
    } catch {
      // may already be disconnected
    }
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    setState((s) => ({
      ...s,
      status: "ended",
      sessionEndedAt: new Date().toISOString(),
    }));
  }, [conversation, addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  // Build final result
  const getResult = useCallback(() => {
    return {
      success: state.status === "ended" && !state.error,
      protocol_id: state.protocolId,
      eleven_session_status: conversation.status,
      error: state.error,
    };
  }, [state, conversation.status]);

  return {
    state,
    startSession,
    startTestSession,
    endSession,
    getResult,
    conversationStatus: conversation.status,
  };
}
