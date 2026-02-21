import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  "sozinha", "drama", "agressor", "violência", "violencia", "copom",
]);

const MAX_WORDS = 30;

type WordFreq = { word: string; count: number };
type AnalysisRow = { palavras_chave: string[] | null; created_at: string };

interface WordCloudCardProps {
  /** ISO date string — only analyses after this date are included */
  since?: string;
}

export default function WordCloudCard({ since }: WordCloudCardProps) {
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<AnalysisRow[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setSelectedWord(null);
      let query = supabase
        .from("gravacoes_analises")
        .select("palavras_chave, created_at");

      if (since) {
        query = query.gte("created_at", since);
      }

      const { data } = await query;
      setAllData((data || []) as AnalysisRow[]);
      setLoading(false);
    }
    fetchData();
  }, [since]);

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

  const fontSizeMap = useMemo(() => {
    const minFont = selectedWord ? 13 : 11;
    const maxFont = selectedWord ? 34 : 30;
    const map: Record<string, number> = {};
    words.forEach((w, i) => {
      const ratio = words.length > 1 ? 1 - i / (words.length - 1) : 1;
      map[w.word] = minFont + ratio * (maxFont - minFont);
    });
    return map;
  }, [words, selectedWord]);

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

  const cardStyle = { background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" };
  const titleStyle = { color: "hsl(220 13% 18%)" };
  const subtitleStyle = { color: "hsl(220 9% 46%)" };

  return (
    <div className="rounded-md border p-4 space-y-3" style={cardStyle}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={titleStyle}>Nuvem de Palavras</h2>
        {selectedWord && (
          <button
            onClick={() => setSelectedWord(null)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:bg-black/5"
            style={{ color: "hsl(224 76% 33%)" }}
          >
            <X className="w-3 h-3" />
            Limpar filtro
          </button>
        )}
      </div>

      {selectedWord && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
          style={{ background: "hsl(224 76% 33% / 0.08)", color: "hsl(224 76% 33%)" }}
        >
          Palavras associadas a <strong>"{selectedWord}"</strong>
        </div>
      )}

      <div className="min-h-[180px] flex items-center justify-center">
        {loading ? (
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "hsl(224 76% 33%)" }} />
        ) : words.length === 0 ? (
          <p className="text-xs" style={subtitleStyle}>
            Nenhuma palavra-chave encontrada.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {shuffled.map((w, i) => (
              <Tooltip key={w.word}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleWordClick(w.word)}
                    className="cursor-pointer transition-all hover:opacity-70 hover:scale-105 font-semibold leading-none border-none bg-transparent p-0"
                    style={{
                      fontSize: `${fontSizeMap[w.word] || 14}px`,
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

      <p className="text-xs text-center" style={subtitleStyle}>
        {words.length} palavras · {words.reduce((s, w) => s + w.count, 0)} ocorrências
      </p>
    </div>
  );
}
