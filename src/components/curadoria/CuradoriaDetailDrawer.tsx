import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useTiposAlerta } from "@/hooks/useTiposAlerta";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BrainCircuit, ChevronDown, ChevronUp, Check, X, Clock, MapPin, Gauge } from "lucide-react";
import { toast } from "sonner";
import CampoAvaliacao, { AvaliacaoData } from "./CampoAvaliacao";
import TranscriptionBubbles from "./TranscriptionBubbles";

interface CuradoriaItem {
  id: string;
  analise_id: string;
  created_at: string;
  duracao_segundos: number | null;
  transcricao_anonimizada: string;
  nivel_risco: string | null;
  sentimento: string | null;
  categorias: string[] | null;
  palavras_chave: string[] | null;
  xingamentos: string[] | null;
  resumo_anonimizado: string;
  cupiado: boolean;
  context_classification: string | null;
  cycle_phase: string | null;
  output_json_anonimizado: any;
}

const RISK_COLORS: Record<string, string> = {
  critico: "bg-red-600 text-white",
  alto: "bg-orange-500 text-white",
  moderado: "bg-yellow-500 text-black",
  baixo: "bg-green-500 text-white",
  nenhum: "bg-gray-400 text-white",
};

const RISK_OPTIONS = [
  { value: "critico", label: "Crítico" },
  { value: "alto", label: "Alto" },
  { value: "moderado", label: "Moderado" },
  { value: "baixo", label: "Baixo" },
  { value: "nenhum", label: "Nenhum" },
];

const SENTIMENTO_OPTIONS = [
  { value: "positivo", label: "Positivo" },
  { value: "negativo", label: "Negativo" },
  { value: "neutro", label: "Neutro" },
  { value: "misto", label: "Misto" },
];

const CYCLE_OPTIONS = [
  { value: "tensao", label: "Tensão" },
  { value: "explosao", label: "Explosão" },
  { value: "lua_de_mel", label: "Lua de mel" },
  { value: "calmaria", label: "Calmaria" },
  { value: "nao_identificado", label: "Não identificado" },
];

const CONTEXT_OPTIONS = [
  { value: "saudavel", label: "Saudável" },
  { value: "rispido_nao_abusivo", label: "Ríspido não abusivo" },
  { value: "potencial_abuso_leve", label: "Potencial abuso leve" },
  { value: "padrao_consistente_abuso", label: "Padrão consistente de abuso" },
  { value: "ameaca_risco", label: "Ameaça/risco" },
  { value: "risco_elevado_escalada", label: "Risco elevado de escalada" },
];

const CAMPOS_AVALIAVEIS = [
  "nivel_risco",
  "sinais_alerta",
  "sentimento",
  "categorias",
  "taticas_manipulativas",
  "cycle_phase",
  "context_classification",
  "tipos_violencia",
] as const;

const TOTAL_CAMPOS = CAMPOS_AVALIAVEIS.length;

async function callAdmin(sessionToken: string, action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke("admin-api", {
    body: { action, session_token: sessionToken, ...params },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

interface Props {
  selected: CuradoriaItem | null;
  onClose: () => void;
  onToggleCupiado: (item: CuradoriaItem) => void;
  onAutoCurada?: () => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const fmtDuration = (s: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m${sec.toString().padStart(2, "0")}s`;
};

const CONTEXT_LABELS: Record<string, string> = {
  saudavel: "Saudável",
  rispido_nao_abusivo: "Ríspido",
  potencial_abuso_leve: "Abuso leve",
  padrao_consistente_abuso: "Padrão abuso",
  ameaca_risco: "Ameaça/risco",
  risco_elevado_escalada: "Risco escalada",
};

export default function CuradoriaDetailDrawer({ selected, onClose, onToggleCupiado, onAutoCurada }: Props) {
  const { sessionToken } = useAuth();
  const [jsonOpen, setJsonOpen] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [resumoOpen, setResumoOpen] = useState(false);

  const { data: tiposViolenciaOpcoes } = useTiposAlerta(["violencia"]);
  const violenciaOptions = useMemo(() => {
    if (!tiposViolenciaOpcoes?.length) return [];
    return tiposViolenciaOpcoes.map(t => ({ value: t.codigo, label: t.label }));
  }, [tiposViolenciaOpcoes]);

  const { data: avaliacoesData, refetch: refetchAvaliacoes } = useQuery({
    queryKey: ["curadoria-avaliacoes", selected?.analise_id],
    queryFn: () => callAdmin(sessionToken!, "getAvaliacoes", { analise_id: selected!.analise_id }),
    enabled: !!sessionToken && !!selected?.analise_id,
  });

  const avaliacoes: Record<string, AvaliacaoData> = {};
  for (const av of avaliacoesData?.avaliacoes || []) {
    avaliacoes[av.campo] = { status: av.status, valor_corrigido: av.valor_corrigido, nota: av.nota || "" };
  }

  const camposAvaliados = CAMPOS_AVALIAVEIS.filter(c => avaliacoes[c]?.status && avaliacoes[c].status !== "pendente").length;
  const progressPercent = Math.round((camposAvaliados / TOTAL_CAMPOS) * 100);

  const handleSaveAvaliacao = useCallback(async (campo: string, data: AvaliacaoData) => {
    if (!selected?.analise_id || !sessionToken) return;
    setSavingField(campo);
    try {
      const result = await callAdmin(sessionToken, "saveAvaliacao", {
        analise_id: selected.analise_id,
        campo,
        status: data.status,
        valor_corrigido: data.valor_corrigido,
        nota: data.nota,
      });
      toast.success(`Avaliação de "${campo}" salva`);
      refetchAvaliacoes();
      if (result?.auto_cupiado) {
        toast.success("Todos os campos avaliados — marcada como curada automaticamente!");
        onAutoCurada?.();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingField(null);
    }
  }, [selected?.analise_id, sessionToken, refetchAvaliacoes]);

  const oj = selected?.output_json_anonimizado || {};
  const sinaisAlerta = oj.sinais_alerta || oj.alert_signs || null;
  const taticasManipulativas = oj.taticas_manipulativas || oj.manipulative_tactics || null;
  const tiposViolencia = oj.tipos_violencia || oj.violence_types || null;

  return (
    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col">
        {selected && (
          <>
            {/* Compact Header */}
            <div className="border-b border-border bg-muted/30 px-6 pt-6 pb-4 space-y-3">
              <SheetHeader className="p-0">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <BrainCircuit className="w-5 h-5 text-primary" />
                  Curadoria da Transcrição
                </SheetTitle>
              </SheetHeader>

              {/* Metadata row */}
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {fmtDate(selected.created_at)}
                </span>
                <span className="text-muted-foreground">{fmtDuration(selected.duracao_segundos)}</span>
                {selected.nivel_risco && (
                  <Badge className={`${RISK_COLORS[selected.nivel_risco] || "bg-muted text-foreground"} text-xs`}>
                    {selected.nivel_risco}
                  </Badge>
                )}
                {selected.sentimento && (
                  <Badge variant="outline" className="text-xs capitalize">{selected.sentimento}</Badge>
                )}
                {selected.context_classification && (
                  <Badge variant="secondary" className="text-xs">
                    {CONTEXT_LABELS[selected.context_classification] || selected.context_classification}
                  </Badge>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Progresso da avaliação</span>
                  <span className={`font-semibold ${camposAvaliados === TOTAL_CAMPOS ? "text-green-600" : "text-foreground"}`}>
                    {camposAvaliados}/{TOTAL_CAMPOS} campos
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            </div>

            {/* Tabs: Transcrição / Avaliação / JSON */}
            <div className="flex-1 overflow-y-auto">
              <Tabs defaultValue="transcricao" className="flex flex-col h-full">
                <div className="px-6 pt-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="transcricao" className="flex-1">Transcrição</TabsTrigger>
                    <TabsTrigger value="avaliacao" className="flex-1">
                      Avaliação
                      {camposAvaliados > 0 && camposAvaliados < TOTAL_CAMPOS && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                          {camposAvaliados}/{TOTAL_CAMPOS}
                        </Badge>
                      )}
                      {camposAvaliados === TOTAL_CAMPOS && (
                        <Check className="ml-1 w-3.5 h-3.5 text-green-600" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="json" className="flex-1">JSON</TabsTrigger>
                  </TabsList>
                </div>

                {/* === TRANSCRIÇÃO === */}
                <TabsContent value="transcricao" className="space-y-4 px-6 pb-6 mt-3">
                  <TranscriptionBubbles
                    transcricao={selected.transcricao_anonimizada}
                    outputJson={selected.output_json_anonimizado}
                    xingamentos={selected.xingamentos}
                    onSaveLineCuration={async (data) => {
                      if (!selected.analise_id || !sessionToken) return;
                      try {
                        await callAdmin(sessionToken, "saveAvaliacao", {
                          analise_id: selected.analise_id,
                          campo: `line_${data.line_index}_${data.alert_type || "manual"}`,
                          status: data.status,
                          valor_corrigido: data.corrected_type ? {
                            alert_type: data.alert_type,
                            alert_label: data.alert_label,
                            corrected_type: data.corrected_type,
                          } : null,
                          nota: data.nota,
                        });
                        toast.success("Avaliação da linha salva");
                        refetchAvaliacoes();
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  />

                  {/* Resumo colapsável */}
                  <Collapsible open={resumoOpen} onOpenChange={setResumoOpen}>
                    <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-foreground w-full">
                      Resumo anonimizado
                      {resumoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="text-sm whitespace-pre-wrap p-3 rounded bg-muted text-foreground mt-2">
                        {selected.resumo_anonimizado || "—"}
                      </p>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Palavras-chave & Xingamentos */}
                  <div className="flex flex-wrap gap-4">
                    {selected.palavras_chave?.length ? (
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Palavras-chave</h4>
                        <div className="flex flex-wrap gap-1">
                          {selected.palavras_chave.map((p, i) => <Badge key={i} variant="outline" className="text-xs">{p}</Badge>)}
                        </div>
                      </div>
                    ) : null}
                    {selected.xingamentos?.length ? (
                      <div>
                        <h4 className="text-xs font-semibold text-destructive mb-1">Xingamentos</h4>
                        <div className="flex flex-wrap gap-1">
                          {selected.xingamentos.map((x, i) => <Badge key={i} variant="destructive" className="text-xs">{x}</Badge>)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </TabsContent>

                {/* === AVALIAÇÃO === */}
                <TabsContent value="avaliacao" className="px-6 pb-24 mt-3 space-y-6">
                  {/* Seção: Classificação */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
                      Classificação
                    </h3>
                    <CampoAvaliacao campo="nivel_risco" label="Nível de Risco" valorIA={selected.nivel_risco} tipo="select" opcoes={RISK_OPTIONS} avaliacao={avaliacoes["nivel_risco"]} onSave={handleSaveAvaliacao} saving={savingField === "nivel_risco"} />
                    <CampoAvaliacao campo="sentimento" label="Sentimento" valorIA={selected.sentimento} tipo="select" opcoes={SENTIMENTO_OPTIONS} avaliacao={avaliacoes["sentimento"]} onSave={handleSaveAvaliacao} saving={savingField === "sentimento"} />
                    <CampoAvaliacao campo="context_classification" label="Classificação de Contexto" valorIA={selected.context_classification} tipo="select" opcoes={CONTEXT_OPTIONS} avaliacao={avaliacoes["context_classification"]} onSave={handleSaveAvaliacao} saving={savingField === "context_classification"} />
                  </div>

                  {/* Seção: Detecção */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
                      Detecção
                    </h3>
                    <CampoAvaliacao campo="taticas_manipulativas" label="Táticas Manipulativas" valorIA={taticasManipulativas} tipo="textarea" avaliacao={avaliacoes["taticas_manipulativas"]} onSave={handleSaveAvaliacao} saving={savingField === "taticas_manipulativas"} />
                    <CampoAvaliacao campo="sinais_alerta" label="Sinais de Alerta" valorIA={sinaisAlerta} tipo="textarea" avaliacao={avaliacoes["sinais_alerta"]} onSave={handleSaveAvaliacao} saving={savingField === "sinais_alerta"} />
                    <CampoAvaliacao campo="categorias" label="Categorias" valorIA={selected.categorias} tipo="tags" avaliacao={avaliacoes["categorias"]} onSave={handleSaveAvaliacao} saving={savingField === "categorias"} />
                  </div>

                  {/* Seção: Ciclo */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
                      Ciclo de Violência
                    </h3>
                    <CampoAvaliacao campo="cycle_phase" label="Fase do Ciclo" valorIA={selected.cycle_phase} tipo="select" opcoes={CYCLE_OPTIONS} avaliacao={avaliacoes["cycle_phase"]} onSave={handleSaveAvaliacao} saving={savingField === "cycle_phase"} />
                    <CampoAvaliacao campo="tipos_violencia" label="Tipos de Violência" valorIA={tiposViolencia} tipo="multiselect" opcoes={violenciaOptions} avaliacao={avaliacoes["tipos_violencia"]} onSave={handleSaveAvaliacao} saving={savingField === "tipos_violencia"} />
                  </div>
                </TabsContent>

                {/* === JSON === */}
                <TabsContent value="json" className="px-6 pb-6 mt-3">
                  {selected.output_json_anonimizado ? (
                    <Collapsible open={jsonOpen} onOpenChange={setJsonOpen}>
                      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-primary">
                        Output JSON (Micro Result)
                        {jsonOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <pre className="text-xs mt-2 p-3 rounded overflow-auto max-h-80 bg-muted text-foreground">
                          {JSON.stringify(selected.output_json_anonimizado, null, 2)}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum output JSON disponível.</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Sticky footer */}
            <div className="border-t border-border bg-card px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {camposAvaliados}/{TOTAL_CAMPOS} avaliados
              </span>
              <Button
                variant={selected.cupiado ? "outline" : "default"}
                size="sm"
                onClick={() => onToggleCupiado(selected)}
              >
                {selected.cupiado ? "Desmarcar curada" : "Marcar como curada"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
