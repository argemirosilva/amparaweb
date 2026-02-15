import { useState } from "react";
import { type SearchResult } from "@/pages/BuscaPerfil";
import { ChevronDown, ChevronUp, Shield, AlertTriangle, MapPin, CheckCircle2, MinusCircle, XCircle, Ban } from "lucide-react";

const STATUS_ICON: Record<string, React.ReactNode> = {
  completo: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  parcial: <MinusCircle className="w-3.5 h-3.5 text-yellow-600" />,
  nao_bateu: <XCircle className="w-3.5 h-3.5 text-muted-foreground" />,
  conflitante: <Ban className="w-3.5 h-3.5 text-destructive" />,
};

const STATUS_LABEL: Record<string, string> = {
  completo: "✅ Completo",
  parcial: "🟡 Parcial",
  nao_bateu: "❌ Não bateu",
  conflitante: "⛔ Conflitante",
};

const RISK_COLORS: Record<string, string> = {
  "Baixo": "bg-green-100 text-green-800",
  "baixo": "bg-green-100 text-green-800",
  "Médio": "bg-yellow-100 text-yellow-800",
  "medio": "bg-yellow-100 text-yellow-800",
  "Alto": "bg-orange-100 text-orange-800",
  "alto": "bg-orange-100 text-orange-800",
  "Crítico": "bg-red-100 text-red-800",
  "critico": "bg-red-100 text-red-800",
};

const VIOLENCE_LABELS: Record<string, string> = {
  psicologica: "Psicológica",
  moral: "Moral",
  patrimonial: "Patrimonial",
  fisica: "Física",
  sexual: "Sexual",
  ameaca_perseguicao: "Ameaça/Perseguição",
};

function ProbabilityBar({ percent }: { percent: number }) {
  const color = percent >= 70 ? "bg-destructive" : percent >= 40 ? "bg-orange-500" : "bg-yellow-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums min-w-[3ch] text-right">{percent}%</span>
    </div>
  );
}

function ResultCard({ result }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ampara-card !p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground">{result.display_name_masked}</p>
          {result.location_summary && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" /> {result.location_summary}
            </p>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${RISK_COLORS[result.risk_level] || "bg-muted text-muted-foreground"}`}>
          {result.risk_level}
        </span>
      </div>

      {/* Probability */}
      <ProbabilityBar percent={result.probability_percent} />

      {/* Signals summary */}
      {result.strong_signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.strong_signals.map((s, i) => (
            <span key={i} className="ampara-tag !py-0.5 !px-2 text-xs">✅ {s}</span>
          ))}
        </div>
      )}
      {result.conflicts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.conflicts.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
              ⛔ {c}
            </span>
          ))}
        </div>
      )}

      {/* Expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Menos detalhes" : "Ver detalhes do match"}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1 border-t border-border">
          {/* Match breakdown */}
          {result.match_breakdown.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Detalhamento</p>
              <div className="space-y-1">
                {result.match_breakdown.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {STATUS_ICON[m.status] || null}
                    <span className="font-medium text-foreground capitalize">{m.field}:</span>
                    <span className="text-muted-foreground truncate">
                      {m.user_value_masked} → {m.candidate_value_masked}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Violence probabilities */}
          {Object.keys(result.violence_probabilities).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Probabilidade por tipo de violência</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(result.violence_probabilities)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([type, prob]) => (
                    <div key={type} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground min-w-[80px]">{VIOLENCE_LABELS[type] || type}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-destructive/70"
                          style={{ width: `${prob}%` }}
                        />
                      </div>
                      <span className="tabular-nums font-medium">{prob}%</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Weak signals */}
          {result.weak_signals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Sinais fracos</p>
              <div className="flex flex-wrap gap-1">
                {result.weak_signals.map((s, i) => (
                  <span key={i} className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">🟡 {s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Explanation */}
          <p className="text-xs text-muted-foreground italic">{result.explanation_short}</p>

          {/* Guidance */}
          {result.guidance.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-foreground mb-1">Sugestões</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {result.guidance.map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function BuscaPerfilResults({ results }: { results: SearchResult[] }) {
  if (results.length === 0) {
    return (
      <div className="ampara-card !p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-foreground">Nenhuma correspondência encontrada</p>
        <p className="text-xs text-muted-foreground">
          Tente adicionar mais dados à busca: bairro, idade, primeiro nome do pai ou da mãe.
        </p>
      </div>
    );
  }

  const weakResults = results.filter(r => r.probability_percent < 30);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {results.length} resultado{results.length > 1 ? "s" : ""} — ordenados por probabilidade
      </p>

      {results.map((r) => (
        <ResultCard key={r.profile_id} result={r} />
      ))}

      {weakResults.length > 0 && weakResults.length === results.length && (
        <div className="bg-muted/50 rounded-xl p-4 text-center space-y-1">
          <p className="text-sm font-medium text-foreground">Resultados com baixa probabilidade</p>
          <p className="text-xs text-muted-foreground">
            Tente adicionar 1 dado extra para reduzir a ambiguidade: bairro, faixa etária, primeiro nome da mãe ou placa parcial.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center leading-relaxed pt-2">
        ⚠️ Estes resultados são estimativas probabilísticas e nunca representam certeza.
        Dados sensíveis são mascarados e nunca armazenados em forma completa.
      </p>
    </div>
  );
}
