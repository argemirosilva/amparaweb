import { useState } from "react";
import { type SearchResult, type SearchFormData } from "@/pages/BuscaPerfil";
import { ChevronDown, ChevronUp, Siren, MapPin, CheckCircle2, MinusCircle, XCircle, Ban, Crosshair, Flag, TrendingUp, AlertTriangle, Info } from "lucide-react";

const STATUS_ICON: Record<string, React.ReactNode> = {
  completo: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  parcial: <MinusCircle className="w-3.5 h-3.5 text-yellow-600" />,
  nao_bateu: <XCircle className="w-3.5 h-3.5 text-muted-foreground" />,
  conflitante: <Ban className="w-3.5 h-3.5 text-destructive" />,
};

const STATUS_LABEL: Record<string, string> = {
  completo: "Completo",
  parcial: "Parcial",
  nao_bateu: "Não bateu",
  conflitante: "Conflitante",
};

const RISK_CONFIG: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  "Baixo": { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  "baixo": { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  "Médio": { bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  "medio": { bg: "bg-yellow-50 dark:bg-yellow-950/30", text: "text-yellow-700 dark:text-yellow-400", border: "border-yellow-200 dark:border-yellow-800", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  "Alto": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  "alto": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800", icon: <TrendingUp className="w-3.5 h-3.5" /> },
  "Crítico": { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  "critico": { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const VIOLENCE_LABELS: Record<string, string> = {
  psicologica: "Psicológica",
  moral: "Moral",
  patrimonial: "Patrimonial",
  fisica: "Física",
  sexual: "Sexual",
  ameaca_perseguicao: "Ameaça/Perseguição",
};

const SENSITIVE_FIELD_MAP: Record<string, keyof SearchFormData> = {
  nome: "nome",
  nome_mae: "nome_mae",
  nome_pai: "nome_pai",
  telefone: "final_telefone",
  ddd: "ddd",
  cidade: "cidade_uf",
  bairro: "bairro",
  profissao: "profissao",
  placa: "placa_parcial",
  cor_raca: "cor_raca",
  escolaridade: "escolaridade",
  empresa: "empresa",
  idade: "idade_aprox",
  cpf: "cpf",
};

function filterDisplayName(maskedName: string, userInput: string): string {
  if (!userInput.trim()) return "Perfil encontrado";
  const inputParts = userInput.trim().toLowerCase().split(/\s+/);
  const nameParts = maskedName.split(/\s+/);
  const filtered = nameParts.map((part) => {
    const partLower = part.toLowerCase().replace(/[*]/g, "");
    if (inputParts.some((ip) => partLower.includes(ip) || ip.includes(partLower))) return part;
    return part.length > 1 ? part[0] + "***" : "***";
  });
  return filtered.join(" ");
}

function ProbabilityBar({ percent }: { percent: number }) {
  const color = percent >= 70 ? "bg-destructive" : percent >= 40 ? "bg-orange-500" : "bg-yellow-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Probabilidade de correspondência</span>
        <span className="text-sm font-bold tabular-nums text-foreground">{percent}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500 ease-out`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ResultCard({ result, searchInput, index }: { result: SearchResult; searchInput: SearchFormData; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const displayName = filterDisplayName(result.display_name_masked, searchInput.nome);
  const showLocation = !!(searchInput.cidade_uf.trim() || searchInput.bairro.trim());
  const showSecurityBadge = searchInput.forca_seguranca === "sim" && result.forca_seguranca;
  const showWeaponBadge = searchInput.tem_arma === "sim" && result.tem_arma_em_casa;

  const riskConfig = RISK_CONFIG[result.risk_level] || { bg: "bg-muted", text: "text-muted-foreground", border: "border-border", icon: <Info className="w-3.5 h-3.5" /> };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Top accent */}
      <div className={`h-1 ${result.probability_percent >= 70 ? "bg-destructive" : result.probability_percent >= 40 ? "bg-orange-400" : "bg-yellow-400"}`} />

      <div className="p-4 space-y-3.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
              {index + 1}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">Perfil #{index + 1}</p>
              {showLocation && result.location_summary && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" /> {result.location_summary}
                </p>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap border ${riskConfig.bg} ${riskConfig.text} ${riskConfig.border}`}>
            {riskConfig.icon} Risco {result.risk_level}
          </span>
        </div>

        {/* Danger badges */}
        {(showSecurityBadge || showWeaponBadge || (result.flags || []).length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {showSecurityBadge && (
              <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                <Shield className="w-3 h-3" /> Força de segurança
              </span>
            )}
            {showWeaponBadge && (
              <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                <Crosshair className="w-3 h-3" /> Possui arma
              </span>
            )}
            {(result.flags || []).map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                <Flag className="w-3 h-3" /> {f}
              </span>
            ))}
          </div>
        )}

        {/* Probability */}
        <ProbabilityBar percent={result.probability_percent} />

        {/* Strong signals */}
        {result.strong_signals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.strong_signals.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-3 h-3" /> {s}
              </span>
            ))}
          </div>
        )}

        {/* Conflicts */}
        {result.conflicts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.conflicts.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                <Ban className="w-3 h-3" /> {c}
              </span>
            ))}
          </div>
        )}

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Menos detalhes" : "Ver detalhes do match"}
        </button>

        {expanded && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Match breakdown */}
            {result.match_breakdown.length > 0 && (
              <div className="rounded-xl bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Detalhamento do Match</p>
                <div className="space-y-1.5">
                  {result.match_breakdown.map((m, i) => {
                    const formField = SENSITIVE_FIELD_MAP[m.field];
                    const userProvided = formField ? !!searchInput[formField]?.trim() : false;
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                        {STATUS_ICON[m.status] || null}
                        <span className="font-medium text-foreground capitalize min-w-[60px]">{m.field}</span>
                        <span className="text-muted-foreground truncate">
                          {userProvided
                            ? `${m.user_value_masked} → ${m.candidate_value_masked}`
                            : STATUS_LABEL[m.status] || m.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Violence probabilities */}
            {Object.keys(result.violence_probabilities).length > 0 && (
              <div className="rounded-xl bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Probabilidade por tipo de violência</p>
                <div className="space-y-2">
                  {Object.entries(result.violence_probabilities)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([type, prob]) => (
                      <div key={type} className="space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{VIOLENCE_LABELS[type] || type}</span>
                          <span className="tabular-nums font-medium text-foreground">{prob}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-destructive/60 transition-all" style={{ width: `${prob}%` }} />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Weak signals */}
            {result.weak_signals.length > 0 && (
              <div className="rounded-xl bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground">Sinais fracos</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.weak_signals.map((s, i) => (
                    <span key={i} className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">🟡 {s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Explanation */}
            <p className="text-xs text-muted-foreground italic px-1">{result.explanation_short}</p>

            {/* Guidance */}
            {result.guidance.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" /> Sugestões
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 pl-5">
                  {result.guidance.map((g, i) => (
                    <li key={i} className="list-disc">{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function BuscaPerfilResults({ results, searchInput }: { results: SearchResult[]; searchInput: SearchFormData }) {
  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mx-auto">
          <Info className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">Nenhuma correspondência encontrada</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Tente adicionar mais dados à busca: bairro, idade, primeiro nome do pai ou da mãe.
        </p>
      </div>
    );
  }

  const weakResults = results.filter(r => r.probability_percent < 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {results.length} resultado{results.length > 1 ? "s" : ""}
        </p>
        <p className="text-xs text-muted-foreground">Ordenados por probabilidade</p>
      </div>

      {results.map((r, i) => (
        <ResultCard key={r.profile_id} result={r} searchInput={searchInput} index={i} />
      ))}

      {weakResults.length > 0 && weakResults.length === results.length && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-center space-y-1.5">
          <p className="text-sm font-medium text-foreground">Resultados com baixa probabilidade</p>
          <p className="text-xs text-muted-foreground">
            Tente adicionar 1 dado extra: bairro, faixa etária, nome da mãe ou placa parcial.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center leading-relaxed pt-1">
        ⚠️ Estimativas probabilísticas, não certezas. Dados sensíveis são mascarados e nunca armazenados em forma completa.
      </p>
    </div>
  );
}
