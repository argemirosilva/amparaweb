import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  AlertTriangle,
  Brain,
  TrendingUp,
  Scale,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  Heart,
  Lightbulb,
} from "lucide-react";
import { callWebApi } from "@/services/webApiService";

interface TaticaManipulativa {
  tatica: string;
  descricao: string;
  evidencia: string;
  gravidade: string;
}

interface AnaliseData {
  resumo: string | null;
  sentimento: string | null;
  nivel_risco: string | null;
  categorias: string[] | null;
  palavras_chave: string[] | null;
  analise_completa: {
    resumo_contexto?: string;
    analise_linguagem?: string[];
    padroes_detectados?: string[];
    tipos_violencia?: string[];
    classificacao_contexto?: string;
    justificativa_risco?: string;
    taticas_manipulativas?: TaticaManipulativa[];
    orientacoes_vitima?: string[];
    sinais_alerta?: string[];
    ciclo_violencia?: {
      fase_atual?: string;
      transicao_detectada?: boolean;
      encurtamento_ciclo?: boolean;
      justificativa?: string;
    };
  } | null;
}

const RISCO_CONFIG: Record<string, { icon: typeof ShieldCheck; color: string; bg: string; label: string }> = {
  sem_risco: { icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Sem Risco" },
  moderado: { icon: ShieldQuestion, color: "text-amber-600", bg: "bg-amber-500/10", label: "Moderado" },
  alto: { icon: ShieldAlert, color: "text-orange-600", bg: "bg-orange-500/10", label: "Alto" },
  critico: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-500/10", label: "Crítico" },
};

const SENTIMENTO_MAP: Record<string, { label: string; color: string }> = {
  positivo: { label: "Positivo", color: "bg-emerald-500/10 text-emerald-700" },
  negativo: { label: "Negativo", color: "bg-red-500/10 text-red-700" },
  neutro: { label: "Neutro", color: "bg-muted text-muted-foreground" },
  misto: { label: "Misto", color: "bg-amber-500/10 text-amber-700" },
};

const CICLO_MAP: Record<string, { label: string; color: string }> = {
  tensao: { label: "Tensão", color: "bg-amber-500/10 text-amber-700" },
  explosao: { label: "Explosão", color: "bg-red-500/10 text-red-700" },
  lua_de_mel: { label: "Lua de mel", color: "bg-sky-500/10 text-sky-700" },
  calmaria: { label: "Calmaria", color: "bg-emerald-500/10 text-emerald-700" },
  nao_identificado: { label: "Não identificado", color: "bg-muted text-muted-foreground" },
};

const CONTEXTO_MAP: Record<string, string> = {
  saudavel: "Saudável",
  rispido_nao_abusivo: "Ríspido mas não abusivo",
  potencial_abuso_leve: "Potencial abuso leve",
  padrao_consistente_abuso: "Padrão consistente de abuso",
  ameaca_risco: "Ameaça / Risco",
  risco_elevado_escalada: "Risco elevado / Escalada",
};

const VIOLENCIA_MAP: Record<string, string> = {
  fisica: "Física", psicologica: "Psicológica", moral: "Moral",
  patrimonial: "Patrimonial", sexual: "Sexual", nenhuma: "Nenhuma",
  violencia_fisica: "Física", violencia_psicologica: "Psicológica",
  ameaca: "Ameaça", coercao: "Coerção", controle: "Controle", assedio: "Assédio",
};

const TATICA_LABELS: Record<string, string> = {
  instrumentalizacao_filhos: "Instrumentalização dos filhos",
  falsa_demonstracao_afeto: "Falsa demonstração de afeto",
  ameaca_juridica_velada: "Ameaça jurídica velada",
  acusacao_sem_evidencia: "Acusação sem evidência",
  gaslighting: "Gaslighting",
  vitimizacao_reversa: "Vitimização reversa",
  controle_disfarçado_preocupacao: "Controle disfarçado de preocupação",
};

const GRAVIDADE_COLORS: Record<string, string> = {
  baixa: "bg-amber-500/10 text-amber-700 border-amber-200",
  media: "bg-orange-500/10 text-orange-700 border-orange-200",
  alta: "bg-red-500/10 text-red-700 border-red-200",
};

export default function AnaliseCard({
  gravacaoId, status, sessionToken, preloadedData, onActiveChange,
}: {
  gravacaoId: string; status: string; sessionToken: string;
  preloadedData?: AnaliseData | null; onActiveChange?: (active: boolean) => void;
}) {
  const [analise, setAnalise] = useState<AnaliseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (preloadedData !== undefined) {
      setAnalise(preloadedData);
      setLoaded(true);
      if (preloadedData) onActiveChange?.(true);
    }
  }, [preloadedData]);

  const canShow = status === "processado";

  const loadAnalise = async () => {
    if (loaded) return;
    setLoading(true);
    onActiveChange?.(true);
    const res = await callWebApi("getAnalise", sessionToken, { gravacao_id: gravacaoId });
    if (res.ok && res.data.analise) setAnalise(res.data.analise);
    setLoaded(true);
    setLoading(false);
  };

  if (!canShow) return null;

  if (!loaded) {
    return (
      <Button variant="outline" size="sm" onClick={loadAnalise} disabled={loading} className="text-xs gap-1.5">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
        Ver análise de IA
      </Button>
    );
  }

  if (!analise) {
    return <p className="text-xs text-muted-foreground italic">Análise não disponível.</p>;
  }

  const risco = RISCO_CONFIG[analise.nivel_risco || "sem_risco"] || RISCO_CONFIG.sem_risco;
  const RiscoIcon = risco.icon;
  const sentimento = SENTIMENTO_MAP[analise.sentimento || "neutro"] || SENTIMENTO_MAP.neutro;
  const completa = analise.analise_completa;
  const contextoLabel = completa?.classificacao_contexto
    ? CONTEXTO_MAP[completa.classificacao_contexto] || completa.classificacao_contexto
    : null;

  const tiposViolencia = (completa?.tipos_violencia || analise.categorias || []).filter((t) => t !== "nenhuma");
  const padroes = completa?.padroes_detectados || [];
  const taticas = completa?.taticas_manipulativas || [];
  const orientacoes = completa?.orientacoes_vitima || [];
  const sinaisAlerta = completa?.sinais_alerta || [];
  const ciclo = completa?.ciclo_violencia;
  const cicloFase = ciclo?.fase_atual ? CICLO_MAP[ciclo.fase_atual] : null;

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header with risk level */}
      <div className="flex items-center gap-3 p-3">
        <div className={`w-10 h-10 rounded-xl ${risco.bg} flex items-center justify-center shrink-0`}>
          <RiscoIcon className={`w-5 h-5 ${risco.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">Risco: {risco.label}</span>
            <Badge className={`${sentimento.color} text-[10px] border-0`}>{sentimento.label}</Badge>
            {contextoLabel && <Badge variant="outline" className="text-[10px]">{contextoLabel}</Badge>}
            {cicloFase && cicloFase.label !== "Não identificado" && (
              <Badge className={`${cicloFase.color} text-[10px] border-0`}>
                Ciclo: {cicloFase.label}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{completa?.resumo_contexto || analise.resumo}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)} className="shrink-0 h-8 w-8 p-0">
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Sinais de Alerta - always visible when present */}
      {sinaisAlerta.length > 0 && (
        <div className="px-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {sinaisAlerta.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px] bg-red-500/5 text-red-600 border-red-200">
                <AlertTriangle className="w-2.5 h-2.5 mr-1" />
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Expanded details */}
      {showDetails && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-3">
          {/* Táticas Manipulativas */}
          {taticas.length > 0 && (
            <Section icon={Eye} title="Táticas Manipulativas Identificadas">
              <div className="space-y-2">
                {taticas.map((t, i) => (
                  <div key={i} className={`rounded-lg border p-2.5 ${GRAVIDADE_COLORS[t.gravidade] || "bg-muted"}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        {TATICA_LABELS[t.tatica] || t.tatica}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {t.gravidade}
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{t.descricao}</p>
                    {t.evidencia && (
                      <p className="text-[11px] text-muted-foreground mt-1 italic border-l-2 border-muted-foreground/30 pl-2">
                        "{t.evidencia}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Orientações para a mulher */}
          {orientacoes.length > 0 && (
            <Section icon={Heart} title="Orientações">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                <ul className="space-y-1.5">
                  {orientacoes.map((o, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                      <Lightbulb className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          )}

          {/* Tipos de violência */}
          {tiposViolencia.length > 0 && (
            <Section icon={Scale} title="Tipos de Violência (Lei Maria da Penha)">
              <div className="flex flex-wrap gap-1.5">
                {tiposViolencia.map((t, i) => (
                  <Badge key={i} variant="destructive" className="text-[10px]">{VIOLENCIA_MAP[t] || t}</Badge>
                ))}
              </div>
            </Section>
          )}

          {/* Padrões detectados */}
          {padroes.length > 0 && (
            <Section icon={TrendingUp} title="Padrões Detectados">
              <ul className="space-y-0.5">
                {padroes.map((p, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                    <span className="text-muted-foreground mt-0.5">•</span>{p}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Ciclo de violência */}
          {ciclo && ciclo.fase_atual && ciclo.fase_atual !== "nao_identificado" && (
            <Section icon={TrendingUp} title="Ciclo de Violência">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {cicloFase && <Badge className={`${cicloFase.color} text-[10px] border-0`}>{cicloFase.label}</Badge>}
                  {ciclo.transicao_detectada && <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-700">Transição detectada</Badge>}
                  {ciclo.encurtamento_ciclo && <Badge variant="outline" className="text-[10px] border-red-200 text-red-700">Encurtamento do ciclo</Badge>}
                </div>
                {ciclo.justificativa && <p className="text-xs text-foreground leading-relaxed">{ciclo.justificativa}</p>}
              </div>
            </Section>
          )}

          {/* Justificativa do risco */}
          {completa?.justificativa_risco && (
            <Section icon={ShieldQuestion} title="Justificativa do Risco">
              <p className="text-xs text-foreground leading-relaxed">{completa.justificativa_risco}</p>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Brain; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="w-3 h-3" />{title}
      </div>
      {children}
    </div>
  );
}
