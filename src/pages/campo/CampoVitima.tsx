import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ArrowLeft, AlertOctagon, Clock, FilePlus2 } from "lucide-react";
import { callCampoApi, type IndicadoresCampo, type NivelRiscoCampo } from "@/services/campoService";
import { toast } from "sonner";

const RISK_STYLES: Record<NivelRiscoCampo, { bg: string; text: string; label: string; icon: string }> = {
  baixo: { bg: "bg-emerald-600", text: "text-white", label: "BAIXO", icon: "🟢" },
  moderado: { bg: "bg-amber-500", text: "text-white", label: "MODERADO", icon: "🟡" },
  alto: { bg: "bg-orange-600", text: "text-white", label: "ALTO", icon: "🟠" },
  critico: { bg: "bg-red-700", text: "text-white", label: "CRÍTICO", icon: "🔴" },
};

const TAG_LABELS: Record<string, string> = {
  risco_baixo: "Risco baixo",
  risco_moderado: "Risco moderado",
  risco_alto: "Risco alto",
  risco_critico: "Risco crítico",
  recorrente: "Recorrente",
  escalada_recente: "Escalada recente",
  historico_previo: "Histórico prévio",
  conflito_pontual: "Conflito pontual",
  indicador_ameaca: "Indicador de ameaça",
  indicador_intimidacao: "Indicador de intimidação",
  indicador_controle: "Indicador de controle",
  indicador_coercao: "Indicador de coerção",
  indicador_agressividade: "Indicador de agressividade",
  dependencia_financeira: "Dependência financeira",
  presenca_filhos: "Presença de filhos",
  convivencia_local: "Convivência no local",
  isolamento_social: "Isolamento social",
  alta_vulnerabilidade: "Alta vulnerabilidade",
  consistente_com_historico: "Consistente com histórico",
  sem_historico_relevante: "Sem histórico relevante",
  padrao_nao_identificado: "Padrão não identificado",
  indicadores_limitados: "Indicadores limitados",
};

export default function CampoVitima() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<IndicadoresCampo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const agente = localStorage.getItem("campo_agente") ?? "";
    const orgao = localStorage.getItem("campo_orgao") ?? "";
    if (!agente) {
      navigate("/campo");
      return;
    }
    (async () => {
      const { ok, data: resp } = await callCampoApi("consultarIndicadores", {
        vitima_id: id,
        agente_identificacao: agente,
        agente_orgao: orgao,
      });
      setLoading(false);
      if (!ok) return toast.error(resp?.error ?? "Falha ao carregar indicadores.");
      setData(resp);
    })();
  }, [id, navigate]);

  const risk = data ? RISK_STYLES[data.nivel_risco] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/campo")} className="text-white hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-6 h-6 text-amber-400" />
          <h1 className="text-base font-bold">Indicadores da vítima</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {loading && (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        )}

        {data && risk && (
          <>
            {/* Nível de risco em destaque */}
            <Card className={`p-6 ${risk.bg} ${risk.text} border-0 shadow-lg`}>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-90">Nível de risco</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-4xl">{risk.icon}</span>
                <span className="text-4xl font-black tracking-tight">{risk.label}</span>
              </div>
              {data.ultima_atualizacao && (
                <p className="text-xs mt-3 opacity-90 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Atualizado em {new Date(data.ultima_atualizacao).toLocaleString("pt-BR")}
                </p>
              )}
            </Card>

            {/* Alerta operacional */}
            <Card className="p-5 border-l-4 border-l-amber-500">
              <div className="flex gap-3">
                <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Alerta operacional</p>
                  <p className="text-sm leading-relaxed">{data.alerta_operacional}</p>
                </div>
              </div>
            </Card>

            {/* Tags */}
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Indicadores estruturados</p>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs px-3 py-1">
                    {TAG_LABELS[t] ?? t}
                  </Badge>
                ))}
              </div>
            </Card>

            {/* Resumo de indicadores */}
            <Card className="p-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Gravações no histórico</p>
                <p className="font-bold text-lg">{data.resumo_indicadores.total_gravacoes}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pânicos (30 dias)</p>
                <p className="font-bold text-lg">{data.resumo_indicadores.panicos_30d}</p>
              </div>
              {data.resumo_indicadores.divergencia && (
                <div className="col-span-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  ⚠ Divergência entre análise interna e autoavaliação. Considere ambas as fontes.
                </div>
              )}
            </Card>

            {/* CTA registrar */}
            <Button
              onClick={() => navigate(`/campo/vitima/${id}/registrar`)}
              className="w-full h-14 text-base font-semibold"
              size="lg"
            >
              <FilePlus2 className="w-5 h-5 mr-2" />
              Registrar atendimento desta ocorrência
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
