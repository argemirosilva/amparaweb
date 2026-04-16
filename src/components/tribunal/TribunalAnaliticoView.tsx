import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, XCircle, MinusCircle, HelpCircle, TrendingUp, Activity, Target, Lightbulb, Repeat } from "lucide-react";

interface Indicador {
  nome: string;
  presente: boolean;
  peso: number;
  evidencia?: string;
}

interface FatorRisco {
  fator: string;
  gravidade: "baixa" | "media" | "alta" | "critica" | string;
  fonte?: string;
}

interface Padrao {
  padrao: string;
  descricao: string;
  frequencia?: string;
}

interface Cruzamento {
  informacao_magistrado: string;
  registro_ampara: string;
  status: "confirmado" | "divergente" | "sem_registro" | "nao_mencionado" | string;
  observacao?: string;
}

interface AnaliseAnalitico {
  score_risco?: number;
  nivel_risco?: string;
  confianca?: number;
  cruzamento_dados?: Cruzamento[];
  indicadores?: Indicador[];
  fatores_risco?: FatorRisco[];
  padroes_identificados?: Padrao[];
  ciclo_violencia?: { fase_atual?: string; tendencia?: string };
  resumo_tecnico?: string;
  recomendacoes_tecnicas?: string[];
  raw?: string;
}

function nivelColor(nivel?: string) {
  if (!nivel) return "text-muted-foreground";
  if (nivel === "critico") return "text-red-600";
  if (nivel === "alto") return "text-orange-500";
  if (nivel === "moderado") return "text-yellow-600";
  return "text-green-600";
}

function nivelBadge(nivel?: string): "default" | "destructive" | "outline" | "secondary" {
  if (nivel === "critico" || nivel === "alto" || nivel === "critica") return "destructive";
  if (nivel === "moderado" || nivel === "media") return "secondary";
  return "outline";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "confirmado") return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === "divergente") return <XCircle className="w-4 h-4 text-red-600" />;
  if (status === "sem_registro") return <HelpCircle className="w-4 h-4 text-yellow-600" />;
  if (status === "nao_mencionado") return <MinusCircle className="w-4 h-4 text-blue-600" />;
  return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
}

function statusLabel(status: string) {
  if (status === "confirmado") return "Confirmado";
  if (status === "divergente") return "Divergente";
  if (status === "sem_registro") return "Sem registro";
  if (status === "nao_mencionado") return "Não mencionado";
  return status;
}

export default function TribunalAnaliticoView({ data }: { data: AnaliseAnalitico }) {
  if (data?.raw) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground italic">
          A IA não retornou JSON estruturado. Conteúdo bruto abaixo:
        </p>
        <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap">{data.raw}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-1">
      {/* Header: score + nível + confiança */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Score</span>
          <span className={`text-3xl font-bold ${nivelColor(data.nivel_risco)}`}>
            {data.score_risco ?? "—"}
          </span>
        </div>
        <Separator orientation="vertical" className="h-12" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Nível</span>
          <Badge variant={nivelBadge(data.nivel_risco)} className="mt-1 text-xs">
            {data.nivel_risco?.replace("_", " ") || "não avaliado"}
          </Badge>
        </div>
        {data.confianca != null && (
          <>
            <Separator orientation="vertical" className="h-12" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Confiança</span>
              <span className="text-base font-semibold text-foreground">{Math.round(data.confianca * 100)}%</span>
            </div>
          </>
        )}
        {data.ciclo_violencia?.fase_atual && (
          <>
            <Separator orientation="vertical" className="h-12" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Ciclo</span>
              <span className="text-xs text-foreground capitalize">
                {data.ciclo_violencia.fase_atual.replace("_", " ")}
                {data.ciclo_violencia.tendencia && ` · ${data.ciclo_violencia.tendencia}`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Resumo técnico */}
      {data.resumo_tecnico && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <Activity className="w-4 h-4 text-primary" /> Resumo Técnico
          </h3>
          <p className="text-sm text-foreground/90 leading-relaxed bg-card border border-border rounded-lg p-3">
            {data.resumo_tecnico}
          </p>
        </section>
      )}

      {/* Cruzamento de dados */}
      {data.cruzamento_dados && data.cruzamento_dados.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <Target className="w-4 h-4 text-primary" /> Cruzamento com Registros AMPARA
          </h3>
          <div className="space-y-2">
            {data.cruzamento_dados.map((c, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3 text-xs space-y-1.5">
                <div className="flex items-start gap-2">
                  <StatusIcon status={c.status} />
                  <Badge variant="outline" className="text-[10px]">{statusLabel(c.status)}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Magistrado informou</p>
                    <p className="text-foreground/90">{c.informacao_magistrado}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground">Registro AMPARA</p>
                    <p className="text-foreground/90">{c.registro_ampara}</p>
                  </div>
                </div>
                {c.observacao && (
                  <p className="pl-6 text-muted-foreground italic">{c.observacao}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Indicadores */}
      {data.indicadores && data.indicadores.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <AlertTriangle className="w-4 h-4 text-primary" /> Indicadores
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.indicadores.map((ind, i) => (
              <div key={i} className={`rounded-lg border p-2.5 text-xs ${ind.presente ? "border-orange-500/40 bg-orange-500/5" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-foreground">{ind.nome}</span>
                  <div className="flex items-center gap-1">
                    {ind.presente ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-orange-500" />
                    ) : (
                      <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <Badge variant="outline" className="text-[10px]">peso {ind.peso}</Badge>
                  </div>
                </div>
                {ind.evidencia && <p className="text-muted-foreground">{ind.evidencia}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fatores de risco */}
      {data.fatores_risco && data.fatores_risco.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <TrendingUp className="w-4 h-4 text-primary" /> Fatores de Risco
          </h3>
          <div className="space-y-1.5">
            {data.fatores_risco.map((f, i) => (
              <div key={i} className="flex items-start gap-2 rounded border border-border bg-card p-2.5 text-xs">
                <Badge variant={nivelBadge(f.gravidade)} className="text-[10px] shrink-0">{f.gravidade}</Badge>
                <span className="flex-1 text-foreground/90">{f.fator}</span>
                {f.fonte && <Badge variant="outline" className="text-[10px] shrink-0">{f.fonte}</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Padrões */}
      {data.padroes_identificados && data.padroes_identificados.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <Repeat className="w-4 h-4 text-primary" /> Padrões Identificados
          </h3>
          <div className="space-y-1.5">
            {data.padroes_identificados.map((p, i) => (
              <div key={i} className="rounded border border-border bg-card p-2.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-foreground">{p.padrao}</span>
                  {p.frequencia && <Badge variant="outline" className="text-[10px]">{p.frequencia}</Badge>}
                </div>
                <p className="text-muted-foreground">{p.descricao}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recomendações */}
      {data.recomendacoes_tecnicas && data.recomendacoes_tecnicas.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <Lightbulb className="w-4 h-4 text-primary" /> Recomendações Técnicas
          </h3>
          <ul className="space-y-1.5">
            {data.recomendacoes_tecnicas.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs rounded border border-border bg-card p-2.5">
                <span className="text-primary font-bold">{i + 1}.</span>
                <span className="text-foreground/90 flex-1">{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
