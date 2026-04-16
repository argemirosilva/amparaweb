import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fonarService } from "@/services/fonarService";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Identificação", subtitle: "Dados básicos do contexto" },
  { id: 2, title: "Histórico de violência", subtitle: "Tipos vivenciados" },
  { id: 3, title: "Ameaças e armas", subtitle: "Risco letal" },
  { id: 4, title: "Frequência e ciclo", subtitle: "Padrão dos episódios" },
  { id: 5, title: "Filhos e dependentes", subtitle: "Pessoas vulneráveis" },
  { id: 6, title: "Rede de apoio", subtitle: "Apoio disponível" },
  { id: 7, title: "Contexto socioeconômico", subtitle: "Recursos e autonomia" },
  { id: 8, title: "Revisão final", subtitle: "Confirme suas respostas" },
];

const TIPOS_VIOLENCIA = [
  { id: "fisica", label: "Física (agressões, empurrões, espancamento)" },
  { id: "psicologica", label: "Psicológica (humilhações, ameaças, controle)" },
  { id: "sexual", label: "Sexual (forçada a atos sem consentimento)" },
  { id: "patrimonial", label: "Patrimonial (controle/destruição de bens)" },
  { id: "moral", label: "Moral (calúnia, difamação)" },
];

export default function FonarWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const suggestionId = params.get("suggestion") || undefined;

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fonarService.overview().then((r) => {
      if (r.submission) {
        setAnswers(r.submission.respostas || {});
        setStep(r.submission.current_step || 1);
      }
    }).finally(() => setLoading(false));
  }, []);

  const setField = (key: string, value: any) => setAnswers((a) => ({ ...a, [key]: value }));

  const toggleArray = (key: string, value: string) => {
    const arr: string[] = answers[key] || [];
    setField(key, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      await fonarService.saveStep(step, answers);
      if (step < STEPS.length) setStep(step + 1);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await fonarService.saveStep(step, answers);
      const res = await fonarService.complete(suggestionId ? "sugestao_revisao" : "manual", suggestionId);
      toast({ title: "FONAR atualizado", description: `Risco calculado: ${res.risk.level}` });
      navigate("/home");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 animate-pulse h-64" />;

  const currentStep = STEPS[step - 1];

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center gap-1 mb-3">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s.id <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Passo {step} de {STEPS.length}</p>
      </div>

      <div>
        <h1 className="text-2xl font-bold font-display">{currentStep.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{currentStep.subtitle}</p>
      </div>

      {/* Step content */}
      <div className="ampara-card p-6 space-y-5">
        {step === 1 && (
          <>
            <div>
              <Label>Há quanto tempo você está no relacionamento?</Label>
              <Input value={answers.tempo_relacionamento || ""} onChange={(e) => setField("tempo_relacionamento", e.target.value)} placeholder="Ex.: 3 anos" />
            </div>
            <div>
              <Label>Vocês moram juntos?</Label>
              <RadioGroup value={answers.mora_junto || ""} onValueChange={(v) => setField("mora_junto", v)} className="mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="mj-sim" /><Label htmlFor="mj-sim">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="mj-nao" /><Label htmlFor="mj-nao">Não</Label></div>
              </RadioGroup>
            </div>
          </>
        )}

        {step === 2 && (
          <div>
            <Label>Quais tipos de violência você já vivenciou neste relacionamento?</Label>
            <div className="space-y-2 mt-3">
              {TIPOS_VIOLENCIA.map((t) => (
                <label key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30">
                  <Checkbox
                    checked={(answers.tipos_violencia || []).includes(t.id)}
                    onCheckedChange={() => toggleArray("tipos_violencia", t.id)}
                  />
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <>
            <div>
              <Label>Ele tem acesso a armas (de fogo, branca)?</Label>
              <RadioGroup value={String(answers.tem_arma ?? "")} onValueChange={(v) => setField("tem_arma", v === "true")} className="mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="true" id="arm-sim" /><Label htmlFor="arm-sim">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="false" id="arm-nao" /><Label htmlFor="arm-nao">Não</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label>Ele já ameaçou matar você?</Label>
              <RadioGroup value={String(answers.ja_ameacou_morte ?? "")} onValueChange={(v) => setField("ja_ameacou_morte", v === "true")} className="mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="true" id="am-sim" /><Label htmlFor="am-sim">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="false" id="am-nao" /><Label htmlFor="am-nao">Não</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label>Ele já tentou matar você?</Label>
              <RadioGroup value={String(answers.ja_tentou_matar ?? "")} onValueChange={(v) => setField("ja_tentou_matar", v === "true")} className="mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="true" id="tm-sim" /><Label htmlFor="tm-sim">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="false" id="tm-nao" /><Label htmlFor="tm-nao">Não</Label></div>
              </RadioGroup>
            </div>
          </>
        )}

        {step === 4 && (
          <div>
            <Label>Com que frequência ocorrem episódios de violência?</Label>
            <RadioGroup value={answers.frequencia || ""} onValueChange={(v) => setField("frequencia", v)} className="mt-2 space-y-1">
              {[
                { v: "diaria", l: "Diariamente" },
                { v: "semanal", l: "Semanalmente" },
                { v: "mensal", l: "Mensalmente" },
                { v: "raro", l: "Raramente" },
              ].map((o) => (
                <div key={o.v} className="flex items-center gap-2"><RadioGroupItem value={o.v} id={`f-${o.v}`} /><Label htmlFor={`f-${o.v}`}>{o.l}</Label></div>
              ))}
            </RadioGroup>
          </div>
        )}

        {step === 5 && (
          <>
            <div>
              <Label>Você tem filhos?</Label>
              <RadioGroup value={String(answers.tem_filhos ?? "")} onValueChange={(v) => setField("tem_filhos", v === "true")} className="mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="true" id="fi-sim" /><Label htmlFor="fi-sim">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="false" id="fi-nao" /><Label htmlFor="fi-nao">Não</Label></div>
              </RadioGroup>
            </div>
            {answers.tem_filhos && (
              <div>
                <Label>Os filhos já presenciaram ou sofreram violência?</Label>
                <RadioGroup value={String(answers.violencia_contra_filhos ?? "")} onValueChange={(v) => setField("violencia_contra_filhos", v === "true")} className="mt-2">
                  <div className="flex items-center gap-2"><RadioGroupItem value="true" id="vf-sim" /><Label htmlFor="vf-sim">Sim</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="false" id="vf-nao" /><Label htmlFor="vf-nao">Não</Label></div>
                </RadioGroup>
              </div>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <div>
              <Label>Você sente que tem rede de apoio (família, amigos)?</Label>
              <RadioGroup value={String(answers.sem_rede_apoio === false ? "true" : answers.sem_rede_apoio === true ? "false" : "")} onValueChange={(v) => setField("sem_rede_apoio", v === "false")} className="mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="true" id="ra-sim" /><Label htmlFor="ra-sim">Sim, tenho apoio</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="false" id="ra-nao" /><Label htmlFor="ra-nao">Não, estou isolada</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label>Quem você procuraria em uma emergência? (opcional)</Label>
              <Textarea value={answers.contato_emergencia || ""} onChange={(e) => setField("contato_emergencia", e.target.value)} />
            </div>
          </>
        )}

        {step === 7 && (
          <>
            <div>
              <Label>Você tem renda própria?</Label>
              <RadioGroup value={String(answers.tem_renda ?? "")} onValueChange={(v) => setField("tem_renda", v === "true")} className="mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="true" id="re-sim" /><Label htmlFor="re-sim">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="false" id="re-nao" /><Label htmlFor="re-nao">Não</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label>Você tem documentos pessoais sob seu controle?</Label>
              <RadioGroup value={String(answers.tem_documentos ?? "")} onValueChange={(v) => setField("tem_documentos", v === "true")} className="mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="true" id="dc-sim" /><Label htmlFor="dc-sim">Sim</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="false" id="dc-nao" /><Label htmlFor="dc-nao">Não</Label></div>
              </RadioGroup>
            </div>
          </>
        )}

        {step === 8 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm font-semibold text-foreground mb-2">Resumo da avaliação</p>
              <p className="text-xs text-muted-foreground">
                Ao confirmar, esta versão será gravada de forma imutável e o risco FONAR será recalculado.
                Esta avaliação é independente do motor da AMPARA.
              </p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Tipos vivenciados: {(answers.tipos_violencia || []).length || "nenhum"}</p>
              <p>• Frequência: {answers.frequencia || "não informada"}</p>
              <p>• Acesso a armas: {answers.tem_arma ? "sim" : "não"}</p>
              <p>• Ameaças de morte: {answers.ja_ameacou_morte ? "sim" : "não"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} disabled={saving}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        {step < STEPS.length ? (
          <Button onClick={handleNext} disabled={saving}>
            Próximo <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={saving}>
            <Check className="w-4 h-4 mr-1" /> Concluir
          </Button>
        )}
      </div>
    </div>
  );
}
