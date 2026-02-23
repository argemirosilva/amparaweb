import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import CampoAvaliacao, { AvaliacaoData } from "./CampoAvaliacao";

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

export default function CuradoriaDetailDrawer({ selected, onClose, onToggleCupiado, onAutoCurada }: Props) {
  const { sessionToken } = useAuth();
  const [jsonOpen, setJsonOpen] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);

  const { data: avaliacoesData, refetch: refetchAvaliacoes } = useQuery({
    queryKey: ["curadoria-avaliacoes", selected?.analise_id],
    queryFn: () => callAdmin(sessionToken!, "getAvaliacoes", { analise_id: selected!.analise_id }),
    enabled: !!sessionToken && !!selected?.analise_id,
  });

  const avaliacoes: Record<string, AvaliacaoData> = {};
  for (const av of avaliacoesData?.avaliacoes || []) {
    avaliacoes[av.campo] = { status: av.status, valor_corrigido: av.valor_corrigido, nota: av.nota || "" };
  }

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

  // Extract output_json fields
  const oj = selected?.output_json_anonimizado || {};
  const sinaisAlerta = oj.sinais_alerta || oj.alert_signs || null;
  const taticasManipulativas = oj.taticas_manipulativas || oj.manipulative_tactics || null;
  const tiposViolencia = oj.tipos_violencia || oj.violence_types || null;

  return (
    <Sheet open={!!selected} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            Detalhes da Transcrição
          </SheetTitle>
        </SheetHeader>

        {selected && (
          <Tabs defaultValue="geral" className="mt-4">
            <TabsList className="w-full flex-wrap h-auto gap-1">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="risco">Risco</TabsTrigger>
              <TabsTrigger value="sentimento">Sentimento</TabsTrigger>
              <TabsTrigger value="taticas">Táticas</TabsTrigger>
              <TabsTrigger value="ciclo">Ciclo</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            {/* === GERAL === */}
            <TabsContent value="geral" className="space-y-4 mt-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground">{fmtDate(selected.created_at)}</span>
                <span className="text-sm text-muted-foreground">{fmtDuration(selected.duracao_segundos)}</span>
                {selected.nivel_risco && (
                  <Badge className={RISK_COLORS[selected.nivel_risco] || "bg-gray-300"}>{selected.nivel_risco}</Badge>
                )}
                <span className="text-sm capitalize text-muted-foreground">{selected.sentimento}</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Transcrição Anonimizada</h3>
                <p className="text-sm whitespace-pre-wrap p-3 rounded bg-muted text-foreground">{selected.transcricao_anonimizada}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Resumo Anonimizado</h3>
                <p className="text-sm whitespace-pre-wrap p-3 rounded bg-muted text-foreground">{selected.resumo_anonimizado || "—"}</p>
              </div>
              {selected.palavras_chave?.length ? (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-1">Palavras-chave</h4>
                  <div className="flex flex-wrap gap-1">
                    {selected.palavras_chave.map((p, i) => <Badge key={i} variant="outline">{p}</Badge>)}
                  </div>
                </div>
              ) : null}
              {selected.xingamentos?.length ? (
                <div>
                  <h4 className="text-xs font-semibold text-destructive mb-1">Xingamentos</h4>
                  <div className="flex flex-wrap gap-1">
                    {selected.xingamentos.map((x, i) => <Badge key={i} variant="destructive">{x}</Badge>)}
                  </div>
                </div>
              ) : null}
              <div className="pt-2">
                <Button
                  variant={selected.cupiado ? "outline" : "default"}
                  onClick={() => onToggleCupiado(selected)}
                >
                  {selected.cupiado ? "Desmarcar curada" : "Marcar como curada"}
                </Button>
              </div>
            </TabsContent>

            {/* === RISCO === */}
            <TabsContent value="risco" className="space-y-4 mt-4">
              <CampoAvaliacao
                campo="nivel_risco"
                label="Nível de Risco"
                valorIA={selected.nivel_risco}
                tipo="select"
                opcoes={RISK_OPTIONS}
                avaliacao={avaliacoes["nivel_risco"]}
                onSave={handleSaveAvaliacao}
                saving={savingField === "nivel_risco"}
              />
              <CampoAvaliacao
                campo="sinais_alerta"
                label="Sinais de Alerta"
                valorIA={sinaisAlerta}
                tipo="textarea"
                avaliacao={avaliacoes["sinais_alerta"]}
                onSave={handleSaveAvaliacao}
                saving={savingField === "sinais_alerta"}
              />
            </TabsContent>

            {/* === SENTIMENTO === */}
            <TabsContent value="sentimento" className="space-y-4 mt-4">
              <CampoAvaliacao
                campo="sentimento"
                label="Sentimento"
                valorIA={selected.sentimento}
                tipo="select"
                opcoes={SENTIMENTO_OPTIONS}
                avaliacao={avaliacoes["sentimento"]}
                onSave={handleSaveAvaliacao}
                saving={savingField === "sentimento"}
              />
              <CampoAvaliacao
                campo="categorias"
                label="Categorias"
                valorIA={selected.categorias}
                tipo="tags"
                avaliacao={avaliacoes["categorias"]}
                onSave={handleSaveAvaliacao}
                saving={savingField === "categorias"}
              />
            </TabsContent>

            {/* === TATICAS === */}
            <TabsContent value="taticas" className="space-y-4 mt-4">
              <CampoAvaliacao
                campo="taticas_manipulativas"
                label="Táticas Manipulativas"
                valorIA={taticasManipulativas}
                tipo="textarea"
                avaliacao={avaliacoes["taticas_manipulativas"]}
                onSave={handleSaveAvaliacao}
                saving={savingField === "taticas_manipulativas"}
              />
            </TabsContent>

            {/* === CICLO === */}
            <TabsContent value="ciclo" className="space-y-4 mt-4">
              <CampoAvaliacao
                campo="cycle_phase"
                label="Fase do Ciclo"
                valorIA={selected.cycle_phase}
                tipo="select"
                opcoes={CYCLE_OPTIONS}
                avaliacao={avaliacoes["cycle_phase"]}
                onSave={handleSaveAvaliacao}
                saving={savingField === "cycle_phase"}
              />
              <CampoAvaliacao
                campo="context_classification"
                label="Classificação de Contexto"
                valorIA={selected.context_classification}
                tipo="select"
                opcoes={CONTEXT_OPTIONS}
                avaliacao={avaliacoes["context_classification"]}
                onSave={handleSaveAvaliacao}
                saving={savingField === "context_classification"}
              />
              <CampoAvaliacao
                campo="tipos_violencia"
                label="Tipos de Violência"
                valorIA={tiposViolencia}
                tipo="tags"
                avaliacao={avaliacoes["tipos_violencia"]}
                onSave={handleSaveAvaliacao}
                saving={savingField === "tipos_violencia"}
              />
            </TabsContent>

            {/* === JSON === */}
            <TabsContent value="json" className="mt-4">
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
        )}
      </SheetContent>
    </Sheet>
  );
}
