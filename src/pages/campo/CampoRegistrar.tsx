import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Shield, ArrowLeft, Check, Loader2 } from "lucide-react";
import { callCampoApi } from "@/services/campoService";
import { toast } from "sonner";

const SITUACOES = [
  { value: "ocorrencia_confirmada", label: "Ocorrência confirmada" },
  { value: "sem_evidencia_no_local", label: "Sem evidência no local" },
  { value: "conflito_verbal", label: "Conflito verbal" },
  { value: "violencia_fisica", label: "Violência física" },
];

const COMPORTAMENTOS = [
  { value: "comportamento_agressivo", label: "Agressivo" },
  { value: "comportamento_intimidatorio", label: "Intimidatório" },
  { value: "comportamento_colaborativo", label: "Colaborativo" },
];

const ESTADOS = [
  { value: "vitima_com_medo", label: "Com medo" },
  { value: "vitima_retraida", label: "Retraída" },
  { value: "vitima_estavel", label: "Estável" },
];

const CONTEXTOS = [
  { value: "presenca_filhos", label: "Presença de filhos" },
  { value: "convivencia_local", label: "Convivência no local" },
  { value: "ambiente_tenso", label: "Ambiente tenso" },
];

export default function CampoRegistrar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [situacao, setSituacao] = useState("");
  const [comportamento, setComportamento] = useState("");
  const [estado, setEstado] = useState("");
  const [contextos, setContextos] = useState<string[]>([]);
  const [observacao, setObservacao] = useState("");
  const [protocolo, setProtocolo] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleContexto = (v: string) => {
    setContextos((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const handleSalvar = async () => {
    if (!situacao) return toast.error("Selecione a situação encontrada.");
    const agente = localStorage.getItem("campo_agente") ?? "";
    const orgao = localStorage.getItem("campo_orgao") ?? "";
    if (!agente) return toast.error("Identificação do agente não encontrada.");

    setSaving(true);

    // GPS opcional (não bloqueia se negar)
    const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { timeout: 3000, enableHighAccuracy: false }
      );
    });

    const { ok, data } = await callCampoApi("registrarOcorrencia", {
      vitima_id: id,
      agente_identificacao: agente,
      agente_orgao: orgao,
      situacao,
      comportamento_requerido: comportamento || undefined,
      estado_vitima: estado || undefined,
      contexto: contextos,
      observacao: observacao.trim() || undefined,
      protocolo_externo: protocolo.trim() || undefined,
      latitude: coords?.lat,
      longitude: coords?.lng,
    });
    setSaving(false);

    if (!ok) return toast.error(data?.error ?? "Falha ao registrar.");
    toast.success("Atendimento registrado com sucesso.");
    navigate("/campo");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-6 h-6 text-amber-400" />
          <h1 className="text-base font-bold">Registrar atendimento</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Situação */}
        <Card className="p-5">
          <Label className="text-sm font-semibold mb-3 block">Situação encontrada *</Label>
          <RadioGroup value={situacao} onValueChange={setSituacao} className="space-y-2">
            {SITUACOES.map((s) => (
              <label key={s.value} className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value={s.value} />
                <span className="text-sm">{s.label}</span>
              </label>
            ))}
          </RadioGroup>
        </Card>

        {/* Comportamento */}
        <Card className="p-5">
          <Label className="text-sm font-semibold mb-3 block">Comportamento do requerido</Label>
          <RadioGroup value={comportamento} onValueChange={setComportamento} className="space-y-2">
            {COMPORTAMENTOS.map((c) => (
              <label key={c.value} className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value={c.value} />
                <span className="text-sm">{c.label}</span>
              </label>
            ))}
          </RadioGroup>
        </Card>

        {/* Estado da vítima */}
        <Card className="p-5">
          <Label className="text-sm font-semibold mb-3 block">Estado da vítima</Label>
          <RadioGroup value={estado} onValueChange={setEstado} className="space-y-2">
            {ESTADOS.map((c) => (
              <label key={c.value} className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value={c.value} />
                <span className="text-sm">{c.label}</span>
              </label>
            ))}
          </RadioGroup>
        </Card>

        {/* Contexto */}
        <Card className="p-5">
          <Label className="text-sm font-semibold mb-3 block">Contexto observado</Label>
          <div className="space-y-2">
            {CONTEXTOS.map((c) => (
              <label key={c.value} className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/40">
                <Checkbox checked={contextos.includes(c.value)} onCheckedChange={() => toggleContexto(c.value)} />
                <span className="text-sm">{c.label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Protocolo externo */}
        <Card className="p-5 space-y-3">
          <div>
            <Label htmlFor="protocolo" className="text-sm font-semibold">Protocolo externo (opcional)</Label>
            <input
              id="protocolo"
              value={protocolo}
              onChange={(e) => setProtocolo(e.target.value)}
              placeholder="Ex: BO 12345/2025"
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm bg-background"
            />
          </div>
          <div>
            <Label htmlFor="obs" className="text-sm font-semibold">Observação curta (máx. 300)</Label>
            <Textarea
              id="obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value.slice(0, 300))}
              maxLength={300}
              rows={3}
              placeholder="Apenas dados objetivos, sem identificar pessoas."
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{observacao.length}/300</p>
          </div>
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4">
        <div className="max-w-3xl mx-auto">
          <Button onClick={handleSalvar} disabled={saving || !situacao} className="w-full h-12 text-base font-semibold">
            {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
            Salvar registro
          </Button>
        </div>
      </div>
    </div>
  );
}
