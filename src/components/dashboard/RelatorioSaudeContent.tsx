import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  ShieldAlert,
  Lightbulb,
  Phone,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  MessageCircle } from
"lucide-react";

export interface RelatorioSaude {
  periodo: {
    inicio: string;
    fim: string;
    dias: number;
    total_gravacoes: number;
    total_alertas: number;
  };
  sentimentos: Record<string, number>;
  tipos_violencia: {tipo: string;contagem: number;}[];
  padroes_recorrentes: {padrao: string;contagem: number;}[];
  palavras_frequentes: {palavra: string;contagem: number;}[];
  panorama_narrativo: string | null;
  explicacao_emocional: string | null;
  orientacoes: string[];
  canais_apoio: string[];
  agressor: Record<string, any>;
  risco_atual: {risk_score: number;risk_level: string;} | null;
}

interface Props {
  relatorio: RelatorioSaude | null;
  loading: boolean;
  error: string | null;
}

import EmotionalFaceIcon, { getEmotionalLevel, computeEmotionalScore } from "./EmotionalFaceIcon";

function SectionHeader({ icon: Icon, title }: {icon: typeof Heart;title: string;}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
    </div>);

}


export default function RelatorioSaudeContent({ relatorio, loading, error }: Props) {
  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>);

  }

  if (error) {
    return <p className="text-sm text-destructive py-2">{error}</p>;
  }

  if (!relatorio || relatorio.periodo.total_gravacoes === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Ainda não há gravações analisadas suficientes para gerar o relatório. Continue usando o app para que possamos acompanhar sua situação.
      </p>);

  }

  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-5 pr-2">
        {/* Seção 1: Panorama */}
        {relatorio.panorama_narrativo &&
        <section>
            <SectionHeader icon={BookOpen} title="Panorama da Relação" />
            <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
              {relatorio.panorama_narrativo}
            </p>
          </section>
        }

        {/* Seção 2: Saúde Emocional */}
        <section>
          <SectionHeader icon={Heart} title="Saúde Emocional" />
          {(() => {
            const score = computeEmotionalScore(relatorio.sentimentos, relatorio.periodo.total_alertas);
            const level = getEmotionalLevel(score);
            return (
              <div className="flex items-center justify-center gap-2 py-1">
                <EmotionalFaceIcon score={score} size={28} />
                <span className="text-sm font-medium text-foreground">{level.label}</span>
              </div>
            );
          })()}
          {relatorio.explicacao_emocional &&
          <p className="mt-1 text-[11px] text-foreground/60 italic leading-relaxed text-center">
              {relatorio.explicacao_emocional}
            </p>
          }
        </section>

        {/* Seção 3: Padrões Identificados */}
        {(relatorio.tipos_violencia.length > 0 || relatorio.padroes_recorrentes.length > 0) &&
        <section>
            <SectionHeader icon={ShieldAlert} title="Padrões Identificados" />

            {relatorio.tipos_violencia.length > 0 &&
          <div className="mb-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Tipos de violência</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {relatorio.tipos_violencia.map((tv) =>
              <Badge
                key={tv.tipo}
                variant="outline"
                className="text-[10px] border-destructive/30 text-destructive/80">

                      <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                      {tv.tipo} ({tv.contagem})
                    </Badge>
              )}
                </div>
              </div>
          }

            {relatorio.padroes_recorrentes.length > 0 &&
          <div className="mb-3">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Padrões recorrentes</span>
                <ul className="mt-1 space-y-0.5">
                  {relatorio.padroes_recorrentes.map((p) =>
              <li key={p.padrao} className="text-xs text-foreground/70 flex items-start gap-1.5">
                      <TrendingUp className="w-3 h-3 mt-0.5 shrink-0 text-orange-500" />
                      <span>{p.padrao} <span className="text-muted-foreground">({p.contagem}x)</span></span>
                    </li>
              )}
                </ul>
              </div>
          }

            {relatorio.palavras_frequentes.length > 0 &&
          <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Palavras frequentes</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {relatorio.palavras_frequentes.map((pw) =>
              <Badge key={pw.palavra} variant="secondary" className="text-[10px]">
                      {pw.palavra}
                    </Badge>
              )}
                </div>
              </div>
          }
          </section>
        }

        {/* Seção 4: Orientações */}
        {relatorio.orientacoes.length > 0 &&
        <section>
            <SectionHeader icon={Lightbulb} title="Orientações para Você" />
            <ul className="space-y-2">
              {relatorio.orientacoes.map((o, i) =>
            <li key={i} className="text-xs text-foreground/80 leading-relaxed flex items-start gap-2">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {i + 1}
                  </span>
                  {o}
                </li>
            )}
            </ul>
          </section>
        }

        {/* Seção 5: Canais de Apoio */}
        {relatorio.canais_apoio.length > 0 &&
        <section>
            <SectionHeader icon={Phone} title="Canais de Apoio" />
            <div className="space-y-1.5">
              {relatorio.canais_apoio.map((c, i) =>
            <div key={i} className="flex items-center gap-2 text-xs text-foreground/70">
                  <MessageCircle className="w-3 h-3 shrink-0 text-primary" />
                  {c}
                </div>
            )}
            </div>
          </section>
        }

        {/* Rodapé: Período */}
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Período: {relatorio.periodo.inicio} a {relatorio.periodo.fim} · {relatorio.periodo.total_gravacoes} gravações analisadas
            {relatorio.periodo.total_alertas > 0 && ` · ${relatorio.periodo.total_alertas} alertas de pânico`}
          </p>
        </div>
      </div>
    </ScrollArea>);

}