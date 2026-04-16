import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, FileJson, FileText, BookOpen, Search, User, UserX, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft, Shield, MapPin, Briefcase, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onConsultaCriada?: () => void;
}

type Step = "busca_vitima" | "busca_agressor" | "processo" | "preview" | "resultado";

interface VitimaResult {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  cor_raca: string | null;
  escolaridade: string | null;
  profissao: string | null;
  mora_com_agressor: boolean;
  tem_filhos: boolean;
  data_nascimento: string | null;
  status: string;
}

interface AgressorResult {
  id: string;
  nome: string;
  display_name_masked: string | null;
  risk_score: number | null;
  risk_level: string | null;
  forca_seguranca: boolean;
  tem_arma_em_casa: boolean;
  primary_city_uf: string | null;
  profession: string | null;
  aliases: string[] | null;
  cor_raca: string | null;
  escolaridade: string | null;
  data_nascimento: string | null;
  cpf_last4: string | null;
  last_incident_at: string | null;
  quality_score: number | null;
  neighborhoods: string[] | null;
  xingamentos_frequentes: string[] | null;
  tipo_vinculo?: string;
  status_relacao?: string;
}

async function tribunalApi(sessionToken: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("tribunal-api", {
    body: { ...body, session_token: sessionToken },
  });
  if (error) throw error;
  return data;
}

function riskColor(level: string | null) {
  if (!level) return "text-muted-foreground";
  if (level === "critico") return "text-red-600";
  if (level === "alto") return "text-orange-500";
  if (level === "moderado") return "text-yellow-600";
  return "text-green-600";
}

function riskBadgeVariant(level: string | null): "default" | "destructive" | "outline" | "secondary" {
  if (level === "critico" || level === "alto") return "destructive";
  if (level === "moderado") return "secondary";
  return "outline";
}

export default function TribunalNovaConsulta({ onConsultaCriada }: Props) {
  const { sessionToken } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("busca_vitima");
  const [loading, setLoading] = useState(false);

  // Search state
  const [vitimaBusca, setVitimaBusca] = useState("");
  const [vitimaTelBusca, setVitimaTelBusca] = useState("");
  const [vitimaResults, setVitimaResults] = useState<VitimaResult[]>([]);
  const [selectedVitima, setSelectedVitima] = useState<VitimaResult | null>(null);

  const [agressorBusca, setAgressorBusca] = useState("");
  const [agressorCpfBusca, setAgressorCpfBusca] = useState("");
  const [agressorResults, setAgressorResults] = useState<AgressorResult[]>([]);
  const [agressoresVinculados, setAgressoresVinculados] = useState<AgressorResult[]>([]);
  const [selectedAgressor, setSelectedAgressor] = useState<AgressorResult | null>(null);

  // Process data
  const [processoTipo, setProcessoTipo] = useState("processo");
  const [processoNumero, setProcessoNumero] = useState("");
  const [processoResumo, setProcessoResumo] = useState("");
  const [processoConteudo, setProcessoConteudo] = useState("");

  // Mode
  const [modo, setModo] = useState("analitico");
  const [incluirAmpara, setIncluirAmpara] = useState(true);

  // Result
  const [resultado, setResultado] = useState<any>(null);

  // ── Search handlers ──

  async function searchVitima() {
    if (!vitimaBusca && !vitimaTelBusca) return;
    setLoading(true);
    try {
      const data = await tribunalApi(sessionToken!, { action: "searchVitima", nome: vitimaBusca || undefined, telefone: vitimaTelBusca || undefined });
      setVitimaResults(data.vitimas || []);
      if (data.vitimas?.length === 0) toast({ title: "Nenhuma vítima encontrada", description: "Tente com outros termos" });
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  async function selectVitima(v: VitimaResult) {
    setSelectedVitima(v);
    setVitimaResults([]);
    // Auto-fetch linked agressors
    setLoading(true);
    try {
      const data = await tribunalApi(sessionToken!, { action: "getAgressoresVinculados", usuario_id: v.id });
      setAgressoresVinculados(data.agressores || []);
    } catch { /* ignore */ }
    setLoading(false);
    setStep("busca_agressor");
  }

  async function searchAgressor() {
    if (!agressorBusca && !agressorCpfBusca) return;
    setLoading(true);
    try {
      const data = await tribunalApi(sessionToken!, { action: "searchAgressor", nome: agressorBusca || undefined, cpf_last4: agressorCpfBusca || undefined });
      setAgressorResults(data.agressores || []);
      if (data.agressores?.length === 0) toast({ title: "Nenhum agressor encontrado", description: "Tente com outros termos" });
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  function selectAgressor(a: AgressorResult) {
    setSelectedAgressor(a);
    setAgressorResults([]);
    setStep("processo");
  }

  // ── Submit ──

  async function handleSubmit() {
    if (!processoConteudo && !processoResumo) {
      toast({ title: "Erro", description: "Informe ao menos o resumo ou conteúdo do processo.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const body: any = {
        action: "consulta",
        modo_saida: modo,
        incluir_dados_ampara: incluirAmpara,
      };
      if (selectedVitima) {
        body.dados_vitima = { nome: selectedVitima.nome_completo, telefone: selectedVitima.telefone };
      }
      if (selectedAgressor) {
        body.dados_agressor = { nome: selectedAgressor.nome, cpf_last4: selectedAgressor.cpf_last4 };
      }
      body.dados_processo = {
        tipo: processoTipo,
        numero: processoNumero || undefined,
        resumo: processoResumo || undefined,
        conteudo: processoConteudo || undefined,
      };
      const data = await tribunalApi(sessionToken!, body);
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResultado(data);
      setStep("resultado");
      toast({ title: "Consulta realizada", description: `Modo: ${modo} - ID: ${data.consulta_id?.substring(0, 8)}` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  // ── Stepper ──

  const steps: { key: Step; label: string }[] = [
    { key: "busca_vitima", label: "Vítima" },
    { key: "busca_agressor", label: "Agressor" },
    { key: "processo", label: "Processo" },
    { key: "preview", label: "Revisar" },
  ];
  const stepIndex = steps.findIndex((s) => s.key === step);

  function StepIndicator() {
    return (
      <div className="flex items-center gap-1 mb-6">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            <button
              onClick={() => { if (i <= stepIndex || (step === "resultado" && i < steps.length)) setStep(s.key); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i === stepIndex || (step === "resultado" && i === steps.length - 1)
                  ? "bg-primary text-primary-foreground"
                  : i < stepIndex
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < stepIndex ? <CheckCircle className="w-3 h-3" /> : null}
              {s.label}
            </button>
            {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
          </div>
        ))}
      </div>
    );
  }

  // ── Cards ──

  function VitimaPreviewCard({ v, compact }: { v: VitimaResult; compact?: boolean }) {
    return (
      <div className={`rounded-lg border border-border p-3 ${compact ? "bg-muted/30" : "bg-card hover:bg-muted/30 cursor-pointer transition-colors"}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{v.nome_completo}</p>
            <p className="text-xs text-muted-foreground">{v.email}</p>
          </div>
          <Badge variant="outline" className="text-xs">{v.status}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {v.telefone && <span>📱 {v.telefone}</span>}
          {(v.endereco_cidade || v.endereco_uf) && <span><MapPin className="w-3 h-3 inline" /> {v.endereco_cidade}/{v.endereco_uf}</span>}
          {v.profissao && <span><Briefcase className="w-3 h-3 inline" /> {v.profissao}</span>}
          {v.data_nascimento && <span><Calendar className="w-3 h-3 inline" /> {new Date(v.data_nascimento).toLocaleDateString("pt-BR")}</span>}
        </div>
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-1">
            {v.mora_com_agressor && <Badge variant="destructive" className="text-[10px]">Mora com agressor</Badge>}
            {v.tem_filhos && <Badge variant="secondary" className="text-[10px]">Tem filhos</Badge>}
            {v.cor_raca && <Badge variant="outline" className="text-[10px]">{v.cor_raca}</Badge>}
            {v.escolaridade && <Badge variant="outline" className="text-[10px]">{v.escolaridade}</Badge>}
          </div>
        )}
      </div>
    );
  }

  function AgressorPreviewCard({ a, compact, showVinculo }: { a: AgressorResult; compact?: boolean; showVinculo?: boolean }) {
    return (
      <div className={`rounded-lg border border-border p-3 ${compact ? "bg-muted/30" : "bg-card hover:bg-muted/30 cursor-pointer transition-colors"}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{a.nome}</p>
            {a.aliases && a.aliases.length > 0 && <p className="text-xs text-muted-foreground">Aliases: {a.aliases.join(", ")}</p>}
          </div>
          <div className="flex items-center gap-1">
            {a.risk_level && <Badge variant={riskBadgeVariant(a.risk_level)} className="text-[10px]">{a.risk_level}</Badge>}
            {a.risk_score != null && <span className={`text-xs font-bold ${riskColor(a.risk_level)}`}>{a.risk_score}</span>}
          </div>
        </div>
        {showVinculo && a.tipo_vinculo && (
          <p className="text-xs text-primary mt-1">Vínculo: {a.tipo_vinculo} {a.status_relacao ? `(${a.status_relacao})` : ""}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {a.primary_city_uf && <span><MapPin className="w-3 h-3 inline" /> {a.primary_city_uf}</span>}
          {a.profession && <span><Briefcase className="w-3 h-3 inline" /> {a.profession}</span>}
          {a.data_nascimento && <span><Calendar className="w-3 h-3 inline" /> {new Date(a.data_nascimento).toLocaleDateString("pt-BR")}</span>}
        </div>
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-1">
            {a.forca_seguranca && <Badge variant="destructive" className="text-[10px]"><Shield className="w-3 h-3 mr-0.5" />Força de segurança</Badge>}
            {a.tem_arma_em_casa && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="w-3 h-3 mr-0.5" />Arma em casa</Badge>}
            {a.cor_raca && <Badge variant="outline" className="text-[10px]">{a.cor_raca}</Badge>}
            {a.escolaridade && <Badge variant="outline" className="text-[10px]">{a.escolaridade}</Badge>}
            {a.last_incident_at && <Badge variant="outline" className="text-[10px]">Último incidente: {new Date(a.last_incident_at).toLocaleDateString("pt-BR")}</Badge>}
          </div>
        )}
      </div>
    );
  }

  // ── Render steps ──

  return (
    <div className="space-y-4">
      <StepIndicator />

      {/* Step 1: Busca Vítima */}
      {step === "busca_vitima" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Identificar Vítima</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Nome completo</Label>
                <Input value={vitimaBusca} onChange={(e) => setVitimaBusca(e.target.value)} placeholder="Nome da vítima" onKeyDown={(e) => e.key === "Enter" && searchVitima()} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={vitimaTelBusca} onChange={(e) => setVitimaTelBusca(e.target.value)} placeholder="(00)00000-0000" onKeyDown={(e) => e.key === "Enter" && searchVitima()} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={searchVitima} disabled={loading || (!vitimaBusca && !vitimaTelBusca)} size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                Buscar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedVitima(null); setStep("busca_agressor"); }}>
                Pular <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {selectedVitima && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-primary">Vítima selecionada:</p>
                <VitimaPreviewCard v={selectedVitima} compact />
                <Button variant="ghost" size="sm" onClick={() => setSelectedVitima(null)} className="text-xs">Alterar seleção</Button>
              </div>
            )}

            {vitimaResults.length > 0 && !selectedVitima && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{vitimaResults.length} resultado(s)</p>
                {vitimaResults.map((v) => (
                  <div key={v.id} onClick={() => selectVitima(v)}>
                    <VitimaPreviewCard v={v} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Busca Agressor */}
      {step === "busca_agressor" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><UserX className="w-4 h-4" /> Identificar Agressor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Linked agressors from victim */}
            {agressoresVinculados.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">Agressores vinculados à vítima:</p>
                {agressoresVinculados.map((a) => (
                  <div key={a.id} onClick={() => selectAgressor(a)}>
                    <AgressorPreviewCard a={a} showVinculo />
                  </div>
                ))}
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">Ou pesquise outro agressor:</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Nome completo</Label>
                <Input value={agressorBusca} onChange={(e) => setAgressorBusca(e.target.value)} placeholder="Nome do agressor" onKeyDown={(e) => e.key === "Enter" && searchAgressor()} />
              </div>
              <div>
                <Label className="text-xs">Últimos 4 dígitos CPF</Label>
                <Input value={agressorCpfBusca} onChange={(e) => setAgressorCpfBusca(e.target.value)} maxLength={4} placeholder="0000" onKeyDown={(e) => e.key === "Enter" && searchAgressor()} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={searchAgressor} disabled={loading || (!agressorBusca && !agressorCpfBusca)} size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                Buscar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep("busca_vitima")}>
                <ArrowLeft className="w-3 h-3 mr-1" /> Voltar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedAgressor(null); setStep("processo"); }}>
                Pular <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {selectedAgressor && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-primary">Agressor selecionado:</p>
                <AgressorPreviewCard a={selectedAgressor} compact />
                <Button variant="ghost" size="sm" onClick={() => setSelectedAgressor(null)} className="text-xs">Alterar seleção</Button>
              </div>
            )}

            {agressorResults.length > 0 && !selectedAgressor && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{agressorResults.length} resultado(s)</p>
                {agressorResults.map((a) => (
                  <div key={a.id} onClick={() => selectAgressor(a)}>
                    <AgressorPreviewCard a={a} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Processo */}
      {step === "processo" && (
        <div className="space-y-4">
          {/* Mode selector */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Modo de Saída</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[
                  { value: "analitico", label: "Analítico", icon: FileJson, desc: "JSON estruturado" },
                  { value: "despacho", label: "Despacho", icon: FileText, desc: "Texto institucional" },
                  { value: "parecer", label: "Parecer", icon: BookOpen, desc: "Parecer técnico" },
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setModo(m.value)}
                    className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                      modo === m.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <m.icon className="w-4 h-4 mb-1" />
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Switch checked={incluirAmpara} onCheckedChange={setIncluirAmpara} />
                <Label className="text-sm">Incluir dados internos AMPARA</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Dados do Processo / Documento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={processoTipo} onValueChange={setProcessoTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="processo">Processo</SelectItem>
                      <SelectItem value="bo">Boletim de Ocorrência</SelectItem>
                      <SelectItem value="medida_protetiva">Medida Protetiva</SelectItem>
                      <SelectItem value="depoimento">Depoimento</SelectItem>
                      <SelectItem value="laudo">Laudo</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Número</Label><Input value={processoNumero} onChange={(e) => setProcessoNumero(e.target.value)} placeholder="Nº do processo/BO" /></div>
              </div>
              <div><Label className="text-xs">Resumo</Label><Textarea value={processoResumo} onChange={(e) => setProcessoResumo(e.target.value)} rows={2} placeholder="Resumo breve do documento" /></div>
              <div><Label className="text-xs">Conteúdo completo</Label><Textarea value={processoConteudo} onChange={(e) => setProcessoConteudo(e.target.value)} rows={6} placeholder="Cole aqui o conteúdo do documento, depoimento, relato..." /></div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("busca_agressor")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button onClick={() => setStep("preview")} className="flex-1" disabled={!processoConteudo && !processoResumo}>
              Revisar e Gerar <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Revisão da Consulta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Vítima</p>
                  {selectedVitima ? (
                    <VitimaPreviewCard v={selectedVitima} compact />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Não identificada</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Agressor</p>
                  {selectedAgressor ? (
                    <AgressorPreviewCard a={selectedAgressor} compact showVinculo />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Não identificado</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Documento</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{processoTipo}</Badge>
                  {processoNumero && <span>Nº {processoNumero}</span>}
                </div>
                {processoResumo && <p className="text-sm text-foreground">{processoResumo}</p>}
                {processoConteudo && <p className="text-xs text-muted-foreground line-clamp-3">{processoConteudo}</p>}
              </div>

              <Separator />

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Modo de Saída</p>
                  <Badge>{modo === "analitico" ? "Analítico (JSON)" : modo === "despacho" ? "Despacho" : "Parecer Técnico"}</Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Dados AMPARA</p>
                  <Badge variant={incluirAmpara ? "default" : "secondary"}>{incluirAmpara ? "Incluídos" : "Não incluídos"}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("processo")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {loading ? "Analisando..." : "Gerar Análise"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Resultado */}
      {step === "resultado" && resultado && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Resultado da Análise</CardTitle>
                <Badge>{modo === "analitico" ? "JSON" : modo === "despacho" ? "Despacho" : "Parecer"}</Badge>
                {resultado.vitima_vinculada && <Badge variant="outline" className="text-xs">Vítima vinculada</Badge>}
                {resultado.agressor_vinculado && <Badge variant="outline" className="text-xs">Agressor vinculado</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[60vh]">
                {modo === "analitico" ? (
                  <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap">
                    {JSON.stringify(resultado.analise, null, 2)}
                  </pre>
                ) : (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                    {resultado.texto}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("preview")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao Preview
            </Button>
            <Button variant="outline" onClick={() => {
              setResultado(null);
              setStep("busca_vitima");
              setSelectedVitima(null);
              setSelectedAgressor(null);
              setAgressoresVinculados([]);
              setProcessoResumo("");
              setProcessoConteudo("");
              setProcessoNumero("");
            }}>
              Nova Consulta
            </Button>
          </div>
        </div>
      )}

      {/* Loading overlay for generating */}
      {loading && step === "preview" && (
        <Card className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Processando análise no modo {modo}...</p>
          </div>
        </Card>
      )}
    </div>
  );
}
