import { useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, XCircle, MessageCircle, Loader2 } from "lucide-react";

interface TranscriptionLine {
  text: string;
  alerts: TranscriptionAlert[];
}

interface TranscriptionAlert {
  type: "tatica" | "xingamento" | "sinal_alerta";
  label: string;
  detail?: string;
}

interface LineCurationData {
  line_index: number;
  status: "correto" | "incorreto";
  nota: string;
}

interface Props {
  transcricao: string;
  outputJson: any;
  xingamentos: string[] | null;
  onSaveLineCuration?: (data: LineCurationData) => Promise<void>;
  savingLine?: number | null;
}

function cleanTranscription(raw: string): string[] {
  if (!raw) return [];
  const text = raw
    .replace(/[\[\(]?\d{1,2}:\d{2}(:\d{2})?[\]\)]?\s*[-–:]?\s*/g, "")
    .replace(/\b(speaker|falante|spk|SPEAKER)[_ ]?\d*\s*[:]\s*/gi, "")
    .replace(/^\s*[-–•]\s*/gm, "");

  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function matchAlerts(
  line: string,
  taticas: any[] | null,
  xingamentos: string[] | null,
  sinaisAlerta: string[] | null
): TranscriptionAlert[] {
  const alerts: TranscriptionAlert[] = [];
  const lineLower = line.toLowerCase();

  // Check xingamentos
  if (xingamentos) {
    for (const x of xingamentos) {
      if (x && lineLower.includes(x.toLowerCase())) {
        alerts.push({ type: "xingamento", label: x });
      }
    }
  }

  // Check taticas - match by evidencia
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

  // Check sinais de alerta
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

function LineCurationPopover({
  lineIndex,
  onSave,
  saving,
}: {
  lineIndex: number;
  onSave: (data: LineCurationData) => Promise<void>;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"correto" | "incorreto">("correto");
  const [nota, setNota] = useState("");

  const handleSave = async () => {
    await onSave({ line_index: lineIndex, status, nota: nota.trim() });
    setOpen(false);
    setNota("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <MessageCircle className="w-3 h-3 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" side="right" align="start">
        <p className="text-xs font-semibold text-foreground">Avaliar detecção</p>
        <RadioGroup value={status} onValueChange={(v) => setStatus(v as any)} className="flex gap-3">
          <div className="flex items-center gap-1">
            <RadioGroupItem value="correto" id={`lc-${lineIndex}-ok`} />
            <Label htmlFor={`lc-${lineIndex}-ok`} className="text-xs text-green-700 cursor-pointer flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> Correto
            </Label>
          </div>
          <div className="flex items-center gap-1">
            <RadioGroupItem value="incorreto" id={`lc-${lineIndex}-err`} />
            <Label htmlFor={`lc-${lineIndex}-err`} className="text-xs text-red-700 cursor-pointer flex items-center gap-0.5">
              <XCircle className="w-3 h-3" /> Incorreto
            </Label>
          </div>
        </RadioGroup>
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota opcional..."
          rows={2}
          className="text-xs"
        />
        <Button size="sm" className="w-full text-xs h-7" onClick={handleSave} disabled={saving}>
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
                <div className="flex flex-wrap gap-1">
                  {line.alerts.map((alert, j) => (
                    <AlertBadge key={j} alert={alert} />
                  ))}
                </div>
              )}
            </div>

            {hasAlerts && onSaveLineCuration && (
              <LineCurationPopover
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
