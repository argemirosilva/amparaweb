import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "all", label: "Todo o período" },
];

const COLORS = [
  "hsl(224 76% 33%)",
  "hsl(224 76% 45%)",
  "hsl(260 50% 40%)",
  "hsl(260 50% 55%)",
  "hsl(220 13% 30%)",
  "hsl(224 76% 55%)",
  "hsl(280 45% 45%)",
  "hsl(220 20% 45%)",
];

// Palavras genéricas a excluir (pedidos de ajuda, sentimentos neutros, etc.)
const EXCLUDED_WORDS = new Set([
  "socorro", "ajuda", "proteger", "abraço", "paz", "saúde",
  "atenção", "prioridade", "preocupado", "sensível",
  "amor", "te amo", "pizza", "salada", "bobagem",
  "ouvir mais e falar menos", "realista",
]);

type WordFreq = { word: string; count: number };

export default function AdminNuvemPalavras() {
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<WordFreq[]>([]);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      let query = supabase
        .from("gravacoes_analises")
        .select("palavras_chave, created_at");

      if (period !== "all") {
        const d = new Date();
        d.setDate(d.getDate() - Number(period));
        query = query.gte("created_at", d.toISOString());
      }

      const { data } = await query;

      const freq: Record<string, number> = {};
      (data || []).forEach((row) => {
        (row.palavras_chave || []).forEach((w: string) => {
          const key = w.trim().toLowerCase();
          if (key && !EXCLUDED_WORDS.has(key)) freq[key] = (freq[key] || 0) + 1;
        });
      });

      const sorted = Object.entries(freq)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count);

      setWords(sorted);
      setLoading(false);
    }
    fetch();
  }, [period]);

  const { minCount, maxCount } = useMemo(() => {
    if (!words.length) return { minCount: 0, maxCount: 1 };
    return {
      minCount: words[words.length - 1].count,
      maxCount: words[0].count,
    };
  }, [words]);

  const fontSize = (count: number) => {
    const range = maxCount - minCount || 1;
    return 14 + ((count - minCount) / range) * 38;
  };

  const shuffled = useMemo(() => {
    const arr = [...words];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [words]);

  return (
    <div className="space-y-6" style={{ fontFamily: "Inter, Roboto, sans-serif" }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Cloud className="w-6 h-6" style={{ color: "hsl(224 76% 33%)" }} />
          <h1 className="text-xl font-bold" style={{ color: "hsl(220 13% 18%)" }}>
            Nuvem de Palavras
          </h1>
        </div>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className="rounded-lg border p-6 min-h-[300px] flex items-center justify-center"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        {loading ? (
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "hsl(224 76% 33%)" }} />
        ) : words.length === 0 ? (
          <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>
            Nenhuma palavra-chave encontrada neste período.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl">
            {shuffled.map((w, i) => (
              <Tooltip key={w.word}>
                <TooltipTrigger asChild>
                  <span
                    className="cursor-default transition-opacity hover:opacity-70 font-semibold leading-none"
                    style={{
                      fontSize: `${fontSize(w.count)}px`,
                      color: COLORS[i % COLORS.length],
                    }}
                  >
                    {w.word}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-medium">{w.word}</span> — {w.count} ocorrência{w.count !== 1 ? "s" : ""}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: "hsl(220 9% 46%)" }}>
        Total: {words.length} palavras · {words.reduce((s, w) => s + w.count, 0)} ocorrências
      </p>
    </div>
  );
}
