import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, Loader2, X } from "lucide-react";
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

const EXCLUDED_WORDS = new Set([
  "socorro", "ajuda", "proteger", "abraço", "paz", "saúde",
  "atenção", "prioridade", "preocupado", "sensível", "perigo",
  "amor", "te amo", "pizza", "salada", "bobagem", "medo",
  "ouvir mais e falar menos", "realista", "cansada", "chateada",
  "sozinha", "drama", "agressor", "violência", "violencia",
]);

const MAX_WORDS = 30;

type WordFreq = { word: string; count: number };
type AnalysisRow = { palavras_chave: string[] | null; created_at: string };

export default function AdminNuvemPalavras() {
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<AnalysisRow[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  // Fetch raw data once per period change
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setSelectedWord(null);
      let query = supabase
        .from("gravacoes_analises")
        .select("palavras_chave, created_at");

      if (period !== "all") {
        const d = new Date();
        d.setDate(d.getDate() - Number(period));
        query = query.gte("created_at", d.toISOString());
      }

      const { data } = await query;
      setAllData((data || []) as AnalysisRow[]);
      setLoading(false);
    }
    fetchData();
  }, [period]);

  // Compute word frequencies, optionally filtered by co-occurrence
  const words = useMemo(() => {
    const rows = selectedWord
      ? allData.filter((r) =>
          (r.palavras_chave || []).some(
            (w) => w.trim().toLowerCase() === selectedWord
          )
        )
      : allData;

    const freq: Record<string, number> = {};
    rows.forEach((row) => {
      (row.palavras_chave || []).forEach((w) => {
        const key = w.trim().toLowerCase();
        if (key && !EXCLUDED_WORDS.has(key) && key !== selectedWord)
          freq[key] = (freq[key] || 0) + 1;
      });
    });

    return Object.entries(freq)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_WORDS);
  }, [allData, selectedWord]);

  const { minCount, maxCount } = useMemo(() => {
    if (!words.length) return { minCount: 0, maxCount: 1 };
    return {
      minCount: words[words.length - 1].count,
      maxCount: words[0].count,
    };
  }, [words]);

  const fontSize = (count: number, index: number, total: number) => {
    const minFont = selectedWord ? 12 : 10;
    const maxFont = selectedWord ? 32 : 28;
    const ratio = total > 1 ? 1 - index / (total - 1) : 1;
    return minFont + ratio * (maxFont - minFont);
  };

  const shuffled = useMemo(() => {
    if (!words.length) return [];
    const [top, ...rest] = words;
    const arr = [...rest];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const mid = Math.floor(arr.length / 2);
    arr.splice(mid, 0, top);
    return arr;
  }, [words]);

  const handleWordClick = useCallback((word: string) => {
    setSelectedWord((prev) => (prev === word ? null : word));
  }, []);

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

      {selectedWord && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
          style={{ background: "hsl(224 76% 33% / 0.08)", color: "hsl(224 76% 33%)" }}
        >
          <span>
            Mostrando palavras associadas a <strong>"{selectedWord}"</strong>
          </span>
          <button
            onClick={() => setSelectedWord(null)}
            className="ml-auto p-0.5 rounded hover:bg-black/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
                  <button
                    onClick={() => handleWordClick(w.word)}
                    className="cursor-pointer transition-all hover:opacity-70 hover:scale-105 font-semibold leading-none border-none bg-transparent p-0"
                    style={{
                      fontSize: `${fontSize(w.count, i, shuffled.length)}px`,
                      color: COLORS[i % COLORS.length],
                    }}
                  >
                    {w.word}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-medium">{w.word}</span> — {w.count} ocorrência{w.count !== 1 ? "s" : ""}
                  <br />
                  <span className="text-xs opacity-70">Clique para ver associadas</span>
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
