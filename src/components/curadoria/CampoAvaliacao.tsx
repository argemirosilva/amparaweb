import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, X, Loader2 } from "lucide-react";

export interface AvaliacaoData {
  status: "correto" | "incorreto" | "pendente";
  valor_corrigido: any;
  nota: string;
}

interface CampoAvaliacaoProps {
  campo: string;
  label: string;
  valorIA: any;
  tipo: "select" | "tags" | "textarea";
  opcoes?: { value: string; label: string }[];
  avaliacao?: AvaliacaoData;
  onSave: (campo: string, data: AvaliacaoData) => Promise<void>;
  saving?: boolean;
}

function formatTatica(t: any): string {
  const nome = t.tatica || t.tactic || "Tática";
  const gravidade = t.gravidade || t.severity || "";
  return nome.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    + (gravidade ? ` (${gravidade})` : "");
}

function isTaticaObject(v: any): boolean {
  return typeof v === "object" && v !== null && (v.tatica || v.tactic);
}

function renderValorIA(valor: any) {
  if (valor === null || valor === undefined) return <span className="text-muted-foreground italic">Não detectado</span>;
  if (Array.isArray(valor)) {
    if (valor.length === 0) return <span className="text-muted-foreground italic">Vazio</span>;
    // Check if it's an array of tactic objects
    if (valor.some(isTaticaObject)) {
      return (
        <div className="space-y-1.5">
          {valor.map((t, i) => (
            <div key={i} className="rounded border border-border bg-muted/50 px-2.5 py-1.5 text-xs space-y-0.5">
              <div className="font-medium text-foreground">{formatTatica(t)}</div>
              {(t.descricao || t.description) && (
                <p className="text-muted-foreground">{t.descricao || t.description}</p>
              )}
              {(t.evidencia || t.evidence) && (
                <p className="text-muted-foreground italic">"{t.evidencia || t.evidence}"</p>
              )}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {valor.map((v, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </Badge>
        ))}
      </div>
    );
  }
  if (typeof valor === "object") return <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">{JSON.stringify(valor, null, 2)}</pre>;
  return <Badge variant="outline">{String(valor)}</Badge>;
}

export default function CampoAvaliacao({ campo, label, valorIA, tipo, opcoes, avaliacao, onSave, saving }: CampoAvaliacaoProps) {
  const [status, setStatus] = useState<"correto" | "incorreto" | "pendente">(avaliacao?.status || "pendente");
  const [valorCorrigido, setValorCorrigido] = useState<any>(avaliacao?.valor_corrigido ?? null);
  const [nota, setNota] = useState(avaliacao?.nota || "");
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => {
    setStatus(avaliacao?.status || "pendente");
    setValorCorrigido(avaliacao?.valor_corrigido ?? null);
    setNota(avaliacao?.nota || "");
    if (avaliacao?.valor_corrigido && tipo === "tags" && Array.isArray(avaliacao.valor_corrigido)) {
      setTagsInput(avaliacao.valor_corrigido.join(", "));
    }
  }, [avaliacao, tipo]);

  const handleSave = () => {
    let vc = valorCorrigido;
    if (status === "incorreto" && tipo === "tags") {
      vc = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    }
    onSave(campo, {
      status,
      valor_corrigido: status === "incorreto" ? vc : null,
      nota: nota.trim() || "",
    });
  };

  const statusColor = status === "correto" ? "text-green-600" : status === "incorreto" ? "text-red-600" : "text-muted-foreground";
  const statusIcon = status === "correto" ? <Check className="w-4 h-4" /> : status === "incorreto" ? <X className="w-4 h-4" /> : null;

  return (
    <div className="p-4 rounded-lg border border-border bg-card space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{label}</h4>
        {status !== "pendente" && (
          <span className={`flex items-center gap-1 text-xs font-medium ${statusColor}`}>
            {statusIcon} {status === "correto" ? "Correto" : "Incorreto"}
          </span>
        )}
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Valor da IA:</span>
        <div className="mt-1">{renderValorIA(valorIA)}</div>
      </div>

      <div>
        <span className="text-xs font-medium text-muted-foreground mb-1 block">Avaliação</span>
        <RadioGroup
          value={status}
          onValueChange={(v) => setStatus(v as any)}
          className="flex gap-4"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="correto" id={`${campo}-correto`} />
            <Label htmlFor={`${campo}-correto`} className="text-sm text-green-700 cursor-pointer">Correto</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="incorreto" id={`${campo}-incorreto`} />
            <Label htmlFor={`${campo}-incorreto`} className="text-sm text-red-700 cursor-pointer">Incorreto</Label>
          </div>
        </RadioGroup>
      </div>

      {status === "incorreto" && (
        <div>
          <span className="text-xs font-medium text-muted-foreground mb-1 block">Valor corrigido</span>
          {tipo === "select" && opcoes && (
            <Select value={valorCorrigido || ""} onValueChange={setValorCorrigido}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o valor correto" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {tipo === "tags" && (
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Valores separados por vírgula"
            />
          )}
          {tipo === "textarea" && (
            <Textarea
              value={typeof valorCorrigido === "string" ? valorCorrigido : JSON.stringify(valorCorrigido || "", null, 2)}
              onChange={(e) => setValorCorrigido(e.target.value)}
              placeholder="Valor corrigido..."
              rows={3}
            />
          )}
        </div>
      )}

      <div>
        <span className="text-xs font-medium text-muted-foreground mb-1 block">Nota do curador</span>
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Observação opcional..."
          rows={2}
        />
      </div>

      <Button size="sm" onClick={handleSave} disabled={saving || status === "pendente"}>
        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
        Salvar avaliação
      </Button>
    </div>
  );
}
