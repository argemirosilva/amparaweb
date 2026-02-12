import { useRef, useState, useEffect } from "react";
import { Play, Pause, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface WaveformMarker {
  position: number; // 0–1
  color: string;
  label?: string;
}

interface Props {
  storagePath: string;
  sessionToken: string;
  markers?: WaveformMarker[];
  accentCssVar?: string; // e.g. "--risco-sem-risco"
  durationHint?: number; // seconds, used to avoid fetching audio for waveform
}

/** Generate random but deterministic-looking peaks for waveform visualization */
function generateFakePeaks(count = 100): Float32Array {
  const peaks = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Create a natural-looking waveform pattern
    const base = 0.3 + Math.sin(i * 0.15) * 0.1;
    const noise = Math.sin(i * 2.7 + 1.3) * 0.2 + Math.sin(i * 5.1 + 0.7) * 0.15;
    peaks[i] = Math.min(1, Math.max(0.05, base + noise));
  }
  return peaks;
}

function resolveColor(cssVar?: string): string {
  const style = getComputedStyle(document.documentElement);
  if (cssVar) {
    const val = style.getPropertyValue(cssVar).trim();
    if (val) return `hsl(${val})`;
  }
  const primary = style.getPropertyValue("--primary").trim();
  return `hsl(${primary})`;
}

export default function WaveformPlayer({ storagePath, sessionToken, markers = [], accentCssVar, durationHint }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ws: any;
    let cancelled = false;

    (async () => {
      // Build proxy URL that streams audio through our edge function (avoids R2 CORS/ORB)
      const proxyUrl = `${SUPABASE_URL}/functions/v1/web-api?action=proxyAudio&session_token=${encodeURIComponent(sessionToken)}&storage_path=${encodeURIComponent(storagePath)}`;

      const { default: WaveSurfer } = await import("wavesurfer.js");
      if (cancelled || !containerRef.current) return;

      const accent = resolveColor(accentCssVar);

      // Use the proxy URL directly - our edge function returns audio with proper CORS headers
      const audio = new Audio();
      audio.src = proxyUrl;

      // Provide fake peaks so WaveSurfer doesn't try to fetch() the URL for waveform decoding
      const fakePeaks = generateFakePeaks(200);
      const estimatedDuration = durationHint || 60;

      ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "hsl(var(--foreground) / 0.3)",
        progressColor: accent,
        cursorColor: "hsl(var(--foreground) / 0.6)",
        cursorWidth: 1,
        barWidth: 3,
        barGap: 2,
        barRadius: 3,
        height: 56,
        media: audio,
        peaks: [fakePeaks],
        duration: estimatedDuration,
        normalize: true,
      });

      wsRef.current = ws;

      ws.on("ready", () => {
        if (!cancelled) {
          setLoading(false);
          setDuration(ws.getDuration());
        }
      });
      ws.on("play", () => !cancelled && setPlaying(true));
      ws.on("pause", () => !cancelled && setPlaying(false));
      ws.on("timeupdate", (t: number) => !cancelled && setCurrentTime(t));
      ws.on("finish", () => !cancelled && setPlaying(false));
      ws.on("error", () => {
        if (!cancelled) { setError(true); setLoading(false); }
      });
    })();

    return () => {
      cancelled = true;
      ws?.destroy();
    };
  }, [storagePath, sessionToken, accentCssVar]);

  const toggle = () => wsRef.current?.playPause();

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  if (error) {
    return (
      <p className="text-xs text-muted-foreground italic py-2">Erro ao carregar áudio</p>
    );
  }

  return (
    <div
      className="rounded-2xl p-4 shadow-lg bg-muted/80 border border-border/50"
    >
      <div className="flex items-center gap-3">
        {/* Play button */}
        <button
          onClick={toggle}
          disabled={loading}
          className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 hover:bg-white/20 transition-all disabled:opacity-40 border border-white/10"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : playing ? (
            <Pause className="w-5 h-5 text-white" />
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" />
          )}
        </button>

        {/* Waveform + markers */}
        <div className="flex-1 relative min-w-0">
          <div ref={containerRef} className="w-full" />

          {!loading && markers.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {markers.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 group"
                  style={{ left: `${m.position * 100}%` }}
                >
                  <div
                    className="w-0.5 h-full opacity-60"
                    style={{ backgroundColor: m.color }}
                  />
                  <div
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full shadow-md border border-white/30"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.label && (
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] bg-black/80 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {m.label}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Time */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[11px] text-white/50 tabular-nums font-mono">
          {fmt(currentTime)}
        </span>
        <span className="text-[11px] text-white/50 tabular-nums font-mono">
          {duration ? fmt(duration) : "—"}
        </span>
      </div>
    </div>
  );
}
