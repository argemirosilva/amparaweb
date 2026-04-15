import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { callWebApi } from "@/services/webApiService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileBarChart,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Shield,
  Phone,
  MessageCircleWarning,
  Lightbulb,
  BookOpen,
  Heart,
  Volume2,
  VolumeX,
  FileText,
  Info,
  ChevronDown,
} from "lucide-react";

interface GravacaoResumo {
  id: string;
  data: string;
  risco: string;
  resumo: string;
}

interface MacroReport {
  id: string;
  window_days: number;
  created_at: string;
  output_json: {
    resumo?: string;
    panorama_narrativo?: string;
    orientacoes?: string[];
    principais_ofensas?: string[];
    canais_apoio?: string[];
    nivel_alerta?: string;
    reflexao_pessoal?: string[];
  };
  aggregates_json: {
    total_gravacoes_analisadas?: number;
    gravacoes_resumos?: GravacaoResumo[];
  };
}

const ALERTA_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  baixo: { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", label: "Baixo" },
  moderado: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", label: "Moderado" },
  alto: { color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", label: "Alto" },
  critico: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Crítico" },
};

const RISCO_BADGE: Record<string, string> = {
  critico: "bg-red-100 text-red-700 border-red-200",
  alto: "bg-orange-100 text-orange-700 border-orange-200",
  moderado: "bg-amber-100 text-amber-700 border-amber-200",
  baixo: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

/** Parses [GR:uuid] markers in panorama text and renders clickable links */
function PanoramaWithCitations({ text, onClickExemplo }: { text: string; onClickExemplo: (id: string) => void }) {
  const parts = useMemo(() => {
    const GR_REGEX = /\[GR:([a-f0-9-]{36})\]/gi;
    const result: { type: "text" | "link"; value: string; id?: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = GR_REGEX.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      result.push({ type: "link", value: match[0], id: match[1] });
      lastIndex = GR_REGEX.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push({ type: "text", value: text.slice(lastIndex) });
    }
    return result;
  }, [text]);

  if (parts.every((p) => p.type === "text")) {
    return <p className="text-xs text-foreground/90 leading-relaxed">{text}</p>;
  }

  return (
    <p className="text-xs text-foreground/90 leading-relaxed">
      {parts.map((part, i) =>
        part.type === "link" ? (
          <button
            key={i}
            onClick={() => onClickExemplo(part.id!)}
            className="inline-flex items-center gap-0.5 text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors font-medium"
            title="Ver transcrição"
          >
            <FileText className="w-2.5 h-2.5 inline shrink-0" />
            exemplo
          </button>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  );
}

export default function MacroReportCard({
  sessionToken,
  windowDays = 7,
  onActiveChange,
}: {
  sessionToken: string;
  windowDays?: number;
  onActiveChange?: (active: boolean) => void;
}) {
  const [report, setReport] = useState<MacroReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExemplos, setShowExemplos] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [ttsState, setTtsState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await callWebApi("getMacroLatest", sessionToken, { window_days: windowDays });
    if (res.ok && res.data.report) {
      setReport(res.data.report);
      onActiveChange?.(true);
    }
    setLoaded(true);
    setLoading(false);
  }, [sessionToken, windowDays, onActiveChange]);

  useEffect(() => {
    setReport(null);
    setLoaded(false);
    fetchReport();
  }, [fetchReport]);

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    onActiveChange?.(true);
    const res = await callWebApi("runMacro", sessionToken, { window_days: windowDays });
    if (res.ok) {
      if (res.data?.skipped) {
        setError("Nenhuma gravação analisada no período. Envie gravações primeiro.");
      } else {
        await fetchReport();
      }
    } else {
      setError(res.data?.error || "Erro ao gerar relatório");
    }
    setGenerating(false);
  };

  const stopTts = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setTtsState("idle");
  }, []);

  const playPanorama = useCallback(async (text: string) => {
    if (ttsState === "playing") {
      stopTts();
      return;
    }
    setTtsState("loading");
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tts-panorama`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ text, session_token: sessionToken }),
      });
      if (!res.ok) throw new Error("TTS falhou");
      const { audioContent } = await res.json();
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      audioRef.current = audio;
      audio.onended = () => setTtsState("idle");
      audio.onerror = () => setTtsState("idle");
      await audio.play();
      setTtsState("playing");
    } catch {
      setTtsState("idle");
    }
  }, [ttsState, sessionToken, stopTts]);

  useEffect(() => () => stopTts(), [stopTts]);

  if (loading && !loaded) {

    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando resumo...</span>
      </div>
    );
  }

  if (!report && loaded) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
          <FileBarChart className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Ainda não tenho dados suficientes para montar seu resumo.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={generateReport}
          disabled={generating}
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileBarChart className="w-3 h-3" />}
          Gerar relatório ({windowDays} dias)
        </Button>
        {error && <p className="text-xs text-destructive text-center">{error}</p>}
      </div>
    );
  }

  if (!report) return null;

  const output = report.output_json;
  const alerta = ALERTA_CONFIG[output.nivel_alerta || "baixo"] || ALERTA_CONFIG.baixo;
  const updatedAt = new Date(report.created_at);
  const isStale = Date.now() - updatedAt.getTime() > 3 * 24 * 60 * 60 * 1000;
  const panorama = output.panorama_narrativo;
  const resumo = output.resumo;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-medium text-primary/70 border-primary/20 flex items-center gap-1.5">
            ✦ Análise da Ampara
          </Badge>
          <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              (output.nivel_alerta || "baixo") === "baixo" ? "bg-emerald-500" :
              (output.nivel_alerta || "baixo") === "moderado" ? "bg-amber-500" :
              (output.nivel_alerta || "baixo") === "alto" ? "bg-orange-500" : "bg-red-500"
            }`} />
            {alerta.label}
          </Badge>
          {isStale && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
              Desatualizado
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {updatedAt.toLocaleDateString("pt-BR")} · {report.aggregates_json.total_gravacoes_analisadas || 0} gravações
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={generateReport}
          disabled={generating}
          title="Atualizar relatório"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Como funciona */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors group w-full">
          <Info className="w-3 h-3 shrink-0" />
          <span className="underline underline-offset-2 decoration-muted-foreground/30 text-xs text-[#c00c78] font-normal">Como este resumo é feito?</span>
          <ChevronDown className="w-3 h-3 ml-auto transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-lg bg-muted/30 border border-border/50 p-3 mt-1.5 space-y-2">
            <p className="text-xs text-foreground/80 leading-relaxed">
              Eu preparei este resumo a partir das suas gravações dos últimos <strong>{report.window_days} dias</strong>. Veja como faço:
            </p>
            <ol className="space-y-1.5 text-xs text-foreground/75 leading-relaxed list-decimal list-inside">
              <li>
                <strong>Escuto e transcrevo</strong> - cada áudio que você envia é transformado em texto.
              </li>
              <li>
                <strong>Analiso individualmente</strong> - leio cada gravação para identificar o que foi dito, o tom da conversa e possíveis sinais de risco.
              </li>
              <li>
                <strong>Olho o conjunto</strong> - reúno todas as análises para montar um panorama geral do período, identificando padrões que se repetem.
              </li>
              <li>
                <strong>Oriento você</strong> - com base nos padrões encontrados, sugiro ações práticas e específicas para a sua situação.
              </li>
            </ol>
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              Analisei {report.aggregates_json.total_gravacoes_analisadas || 0} gravações para montar este resumo. Você pode clicar nos links "ouvir" no texto para conferir os áudios citados.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Panorama */}
      {panorama && (
        <div className="rounded-lg bg-muted/30 border border-border/50 p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <BookOpen className="w-3 h-3" />
              Panorama
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 shrink-0"
              onClick={() => playPanorama(panorama)}
              disabled={ttsState === "loading"}
              title={ttsState === "playing" ? "Parar áudio" : "Ouvir panorama"}
            >
              {ttsState === "loading" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : ttsState === "playing" ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          <PanoramaWithCitations text={panorama} onClickExemplo={(id) => { setHighlightId(id); setShowExemplos(true); }} />
        </div>
      )}

      {/* Resumo (if different from panorama) */}
      {resumo && resumo !== panorama && (
        <p className="text-xs text-muted-foreground italic leading-relaxed px-1">
          {resumo}
        </p>
      )}

      {/* Orientações */}
      {output.orientacoes && output.orientacoes.length > 0 && (
        <div className="rounded-lg bg-primary/[0.03] border border-primary/10 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-primary/70 uppercase tracking-wider">
            <Lightbulb className="w-3 h-3" />
            Orientações
          </div>
          <ul className="space-y-1.5">
            {output.orientacoes.map((o, i) => (
              <li key={i} className="text-xs text-foreground/85 leading-relaxed flex items-start gap-2">
                <span className="text-primary/50 mt-0.5 shrink-0 text-[10px]">✦</span>
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reflexão pessoal */}
      {output.reflexao_pessoal && output.reflexao_pessoal.length > 0 && (
        <div className="rounded-lg bg-accent/30 border border-accent/50 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-accent-foreground/70 uppercase tracking-wider">
            <Heart className="w-3 h-3" />
            Para refletir
          </div>
          <ul className="space-y-1.5">
            {output.reflexao_pessoal.map((r, i) => (
              <li key={i} className="text-xs text-foreground/85 leading-relaxed flex items-start gap-2 italic">
                <span className="text-accent-foreground/50 mt-0.5 shrink-0 text-[10px]">💭</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Principais ofensas */}
      {output.principais_ofensas && output.principais_ofensas.length > 0 && (
        <div className="rounded-lg bg-destructive/[0.03] border border-destructive/10 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-destructive/70 uppercase tracking-wider">
            <MessageCircleWarning className="w-3 h-3" />
            OFENSAS MAIS FREQUENTES
          </div>
          <div className="flex flex-wrap gap-1.5">
            {output.principais_ofensas.map((o, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] bg-destructive/5 text-destructive/80 border-destructive/15"
              >
                {o}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Canais de apoio */}
      {output.canais_apoio && output.canais_apoio.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {output.canais_apoio.map((c, i) => (
            <Badge key={i} variant="outline" className="text-[10px] bg-primary/5 border-primary/20">
              <Phone className="w-2.5 h-2.5 mr-1" />{c}
            </Badge>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />{error}
        </p>
      )}
    </div>
  );
}
