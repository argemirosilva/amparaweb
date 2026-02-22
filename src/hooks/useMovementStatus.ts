import { useRef, useCallback } from "react";

// ── Types ───────────────────────────────────────────────
export type MovementStatus = "parado" | "caminhando" | "veiculo";

export interface MovementResult {
  status: MovementStatus;
  label: string;
  emoji: string;
  speedKmh: number;
  /** Tailwind color classes for the badge */
  badgeClass: string;
}

// ── Constants ───────────────────────────────────────────
const BUFFER_SIZE = 3;
const NOISE_THRESHOLD_KMH = 2;
const NOISE_PRECISION_THRESHOLD = 30; // meters
const HYSTERESIS_COUNT = 2; // consecutive readings to confirm change

// ── Helpers ─────────────────────────────────────────────

/** Max plausible speed in km/h – anything above is a GPS spike */
const MAX_SPEED_KMH = 200;

/** Normalize speed to km/h. GPS always reports m/s; clamp absurd values. */
function normalizeSpeed(speed: number | null): number {
  if (speed === null || speed <= 0) return 0;
  const kmh = speed * 3.6; // m/s → km/h
  if (kmh > MAX_SPEED_KMH) return 0; // discard GPS spikes
  return Math.round(kmh * 10) / 10;
}

function classify(avgSpeed: number): MovementStatus {
  if (avgSpeed === 0) return "parado";
  if (avgSpeed >= 1 && avgSpeed <= 15) return "caminhando";
  return "veiculo";
}

const STATUS_MAP: Record<MovementStatus, { label: string; emoji: string; badgeClass: string }> = {
  parado: { label: "Parada", emoji: "📍", badgeClass: "bg-muted text-muted-foreground" },
  caminhando: { label: "Caminhando", emoji: "🚶‍♀️", badgeClass: "bg-blue-500/10 text-blue-600" },
  veiculo: { label: "Em Veículo", emoji: "🚗", badgeClass: "bg-orange-500/10 text-orange-600" },
};

// ── Hook ────────────────────────────────────────────────

/**
 * Anti-noise movement status classifier.
 *
 * Call `update(speed, precisao)` each time a new GPS reading arrives.
 * Returns the debounced, filtered movement status.
 */
export function useMovementStatus() {
  const bufferRef = useRef<number[]>([]);
  const confirmedRef = useRef<MovementStatus>("parado");
  const candidateRef = useRef<MovementStatus>("parado");
  const candidateCountRef = useRef(0);

  const update = useCallback((speed: number | null, precisaoMetros: number | null): MovementResult => {
    const speedKmh = normalizeSpeed(speed);

    // 1. Push to rolling buffer
    const buf = bufferRef.current;
    buf.push(speedKmh);
    if (buf.length > BUFFER_SIZE) buf.shift();

    // 2. Average
    const avg = buf.reduce((a, b) => a + b, 0) / buf.length;

    // 3. Noise filter: low speed + poor precision → treat as 0
    const filteredAvg =
      avg <= NOISE_THRESHOLD_KMH && (precisaoMetros === null || precisaoMetros > NOISE_PRECISION_THRESHOLD)
        ? 0
        : avg;

    // 4. Classify
    const newStatus = classify(filteredAvg);

    // 5. Hysteresis
    if (newStatus !== confirmedRef.current) {
      if (newStatus === candidateRef.current) {
        candidateCountRef.current++;
      } else {
        candidateRef.current = newStatus;
        candidateCountRef.current = 1;
      }
      if (candidateCountRef.current >= HYSTERESIS_COUNT) {
        confirmedRef.current = newStatus;
      }
    } else {
      // Reset candidate if we're back to confirmed
      candidateRef.current = newStatus;
      candidateCountRef.current = 0;
    }

    const confirmed = confirmedRef.current;
    const meta = STATUS_MAP[confirmed];

    return {
      status: confirmed,
      label: meta.label,
      emoji: meta.emoji,
      speedKmh: Math.round(filteredAvg * 10) / 10,
      badgeClass: meta.badgeClass,
    };
  }, []);

  return { update };
}

/**
 * Stateless single-shot classifier (for contexts without buffer, e.g. initial render).
 * Does NOT apply hysteresis or smoothing.
 */
export function classifyMovement(speed: number | null): MovementResult {
  const speedKmh = normalizeSpeed(speed);
  const status = classify(speedKmh);
  const meta = STATUS_MAP[status];
  return { status, label: meta.label, emoji: meta.emoji, speedKmh, badgeClass: meta.badgeClass };
}
