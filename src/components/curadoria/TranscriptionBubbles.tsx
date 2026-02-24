import { useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, XCircle, MessageCircle, Loader2, Plus } from "lucide-react";

interface TranscriptionLine {
  text: string;
  alerts: TranscriptionAlert[];
}

interface TranscriptionAlert {
  type: "tatica" | "xingamento" | "sinal_alerta";
  label: string;
  detail?: string;
}

export interface LineCurationData {
  line_index: number;
  status: "correto" | "incorreto";
  nota: string;
  alert_type?: string;
  alert_label?: string;
  corrected_type?: string;
}

const ALERT_TYPE_OPTIONS = [
  { value: "xingamento", label: "Xingamento" },
  { value: "ameaca", label: "Ameaça" },
  { value: "violencia_psicologica", label: "Violência Psicológica" },
  { value: "violencia_fisica", label: "Violência Física" },
  { value: "tatica_manipulativa", label: "Tática Manipulativa" },
  { value: "sinal_alerta", label: "Sinal de Alerta" },
  { value: "nenhum", label: "Nenhum (falso positivo)" },
];

interface Props {
  transcricao: string;
  outputJson: any;
  xingamentos: string[] | null;
  onSaveLineCuration?: (data: LineCurationData) => Promise<void>;
  savingLine?: number | null;
}

function cleanTranscription(raw: string): string[] {
  if (!raw) return [];

  const trimmed = raw.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const texts = arr.map((seg: any) => (seg.text || "").trim()).filter((t: string) => t.length > 2);
      if (texts.length > 0) return texts;
    } catch {
      const textMatches = [...trimmed.matchAll(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
      if (textMatches.length > 0) {
        const texts = textMatches.map(m => m[1].replace(/\\"/g, '"').trim()).filter(t => t.length > 2);
        if (texts.length > 0) return texts;
      }
    }
  }

  const lines = raw.split(/\n+/);
  const cleaned: string[] = [];

  for (const line of lines) {
    let l = line.trim();
    if (!l) continue;
    l = l.replace(/[\[\(]?\d{1,2}:\d{2}(:\d{2})?[\]\)]?\s*[-–:]?\s*/g, "");
    l = l.replace(/\b(speaker|falante|spk|SPEAKER)[_ ]?\d*\s*[:]\s*/gi, "");
    l = l.replace(/\[[^\]]*\]/g, "").trim();
    l = l.replace(/^\s*[-–•]\s*/g, "");
    if (/^(confian[cç]a|confidence|score|risco|risk|sentimento|sentiment|categoria|category|resumo|summary|nivel|level)\s*[:=]/i.test(l)) continue;
    if (/^\s*\{/.test(l) || /^\s*\[/.test(l)) continue;
    if (/^(tags?|label|tipo|type|output|result|modelo|model)\s*[:=]/i.test(l)) continue;
    if (/^\d+(\.\d+)?%?\s*$/.test(l)) continue;
    if (/^[-–=_]{3,}$/.test(l)) continue;
    const sentences = l.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 2);
    cleaned.push(...(sentences.length > 0 ? sentences : [l]));
  }

  const result = cleaned.filter(s => s.length > 2);
  if (result.length === 0 && raw.trim().length > 0) {
    return raw.split(/\n+/).map(l => l.trim()).filter(l => l.length > 2);
  }
  return result;
}

function matchAlerts(
  line: string,
  taticas: any[] | null,
  xingamentos: string[] | null,
  sinaisAlerta: string[] | null
): TranscriptionAlert[] {
  const alerts: TranscriptionAlert[] = [];
  const lineLower = line.toLowerCase();

  if (xingamentos) {
    for (const x of xingamentos) {
      if (x && lineLower.includes(x.toLowerCase())) {
        alerts.push({ type: "xingamento", label: x });
      }
    }
  }

  if (taticas && Array.isArray(taticas)) {
    for (const t of taticas) {
      const evidencia = (t.evidencia || t.evidence || "").toLowerCase();
      if (evidencia && lineLower.includes(evidencia.replace(/"/g, "").substring(0, 20).toLowerCase())) {
        alerts.push({
          type: "tatica",
          label: t.tatica || t.tactic || "tática detectada",
          detail: t.descricao || t.description,
        });
      }
    }
  }

  if (sinaisAlerta && Array.isArray(sinaisAlerta)) {
    for (const sinal of sinaisAlerta) {
      const keywords = sinal.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      const matchCount = keywords.filter(kw => lineLower.includes(kw)).length;
      if (keywords.length > 0 && matchCount >= Math.ceil(keywords.length * 0.5)) {
        alerts.push({ type: "sinal_alerta", label: sinal });
      }
    }
  }

  return alerts;
}

function AlertBadge({ alert }: { alert: TranscriptionAlert }) {
  const config = {
    xingamento: { variant: "destructive" as const, icon: "🤬" },
    tatica: { variant: "secondary" as const, icon: "🎭" },
    sinal_alerta: { variant: "outline" as const, icon: "⚠️" },
  };
  const c = config[alert.type];

  return (
    <Badge variant={c.variant} className="text-[10px] py-0 px-1.5 gap-0.5">
      <span>{c.icon}</span> {alert.label}
    </Badge>
  );
}

/* ── Popover to evaluate a SPECIFIC alert on a line ── */
function AlertCurationPopover({
  lineIndex,
  alert,
  onSave,
  saving,
}: {
  lineIndex: number;
  alert: TranscriptionAlert;
  onSave: (data: LineCurationData) => Promise<void>;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"correto" | "incorreto">("correto");
  const [correctedType, setCorrectedType] = useState("");
  const [nota, setNota] = useState("");

  const handleSave = async () => {
    await onSave({
      line_index: lineIndex,
      status,
      nota: nota.trim(),
      alert_type: alert.type,
      alert_label: alert.label,
      corrected_type: status === "incorreto" ? correctedType : undefined,
    });
    setOpen(false);
    setNota("");
    setCorrectedType("");
    setStatus("correto");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <MessageCircle className="w-3 h-3 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2 z-50 bg-popover" side="right" align="start">
        <p className="text-xs font-semibold text-foreground">Avaliar detecção</p>
        <div className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">
          {alert.type === "xingamento" && "🤬"}
          {alert.type === "tatica" && "🎭"}
          {alert.type === "sinal_alerta" && "⚠️"}
          {" "}<span className="font-medium text-foreground">{alert.label}</span>
        </div>

        <RadioGroup value={status} onValueChange={(v) => setStatus(v as any)} className="flex gap-3">
          <div className="flex items-center gap-1">
            <RadioGroupItem value="correto" id={`ac-${lineIndex}-${alert.label}-ok`} />
            <Label htmlFor={`ac-${lineIndex}-${alert.label}-ok`} className="text-xs text-green-700 cursor-pointer flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> Correto
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <RadioGroupItem value="incorreto" id={`ac-${lineIndex}-${alert.label}-err`} />
            <Label htmlFor={`ac-${lineIndex}-${alert.label}-err`} className="text-xs text-red-700 cursor-pointer flex items-center gap-0.5">
              <XCircle className="w-3 h-3" /> Incorreto
            </Label>
          </div>
        </RadioGroup>

        {status === "incorreto" && (
          <Select value={correctedType} onValueChange={setCorrectedType}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Tipo correto..." />
            </SelectTrigger>
            <SelectContent className="z-[60] bg-popover">
              {ALERT_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota opcional..." rows={2} className="text-xs" />
        <Button size="sm" className="w-full text-xs h-7" onClick={handleSave} disabled={saving || (status === "incorreto" && !correctedType)}>
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Salvar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/* ── Popover to ADD an alert on a line with no detections ── */
function AddAlertPopover({
  lineIndex,
  onSave,
  saving,
}: {
  lineIndex: number;
  onSave: (data: LineCurationData) => Promise<void>;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [alertType, setAlertType] = useState("");
  const [nota, setNota] = useState("");

  const handleSave = async () => {
    await onSave({
      line_index: lineIndex,
      status: "incorreto",
      nota: nota.trim(),
      alert_type: "nenhum",
      alert_label: "Não detectado pela IA",
      corrected_type: alertType,
    });
    setOpen(false);
    setNota("");
    setAlertType("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="w-3 h-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2 z-50 bg-popover" side="right" align="start">
        <p className="text-xs font-semibold text-foreground">Adicionar alerta não detectado</p>
        <Select value={alertType} onValueChange={setAlertType}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Tipo de alerta..." />
          </SelectTrigger>
          <SelectContent className="z-[60] bg-popover">
            {ALERT_TYPE_OPTIONS.filter(o => o.value !== "nenhum").map(o => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota opcional..." rows={2} className="text-xs" />
        <Button size="sm" className="w-full text-xs h-7" onClick={handleSave} disabled={saving || !alertType}>
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Salvar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default function TranscriptionBubbles({ transcricao, outputJson, xingamentos, onSaveLineCuration, savingLine }: Props) {
  const oj = outputJson || {};
  const taticas = oj.taticas_manipulativas || oj.manipulative_tactics || null;
  const sinaisAlerta = oj.sinais_alerta || oj.alert_signs || null;

  const lines: TranscriptionLine[] = useMemo(() => {
    const sentences = cleanTranscription(transcricao);
    return sentences.map((text) => ({
      text,
      alerts: matchAlerts(text, taticas, xingamentos, sinaisAlerta),
    }));
  }, [transcricao, taticas, xingamentos, sinaisAlerta]);

  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Transcrição vazia</p>;
  }

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const hasAlerts = line.alerts.length > 0;
        return (
          <div
            key={i}
            className={`group flex items-start gap-2 rounded-lg px-3 py-2 transition-colors ${
              hasAlerts
                ? "bg-destructive/5 border border-destructive/15"
                : "bg-muted/50"
            }`}
          >
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm text-foreground leading-relaxed">{line.text}</p>
              {hasAlerts && (
                <div className="flex flex-wrap items-center gap-1">
                  {line.alerts.map((alert, j) => (
                    <div key={j} className="flex items-center gap-0.5">
                      <AlertBadge alert={alert} />
                      {onSaveLineCuration && (
                        <AlertCurationPopover
                          lineIndex={i}
                          alert={alert}
                          onSave={onSaveLineCuration}
                          saving={savingLine === i}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add alert button for lines WITHOUT detections */}
            {!hasAlerts && onSaveLineCuration && (
              <AddAlertPopover
                lineIndex={i}
                onSave={onSaveLineCuration}
                saving={savingLine === i}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
