import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  generateInstitucionalPDF,
  generateMunicipioPDF,
  generateConformidadePDF,
  exportCSV,
} from "@/services/pdfReportService";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

interface ReportDef {
  id: string;
  nome: string;
  descricao: string;
  pdfFn: (period: string) => Promise<void>;
  csvType: string;
}

const reports: ReportDef[] = [
  {
    id: "institucional",
    nome: "Relatório mensal institucional",
    descricao: "Consolidado mensal com KPIs, distribuição geográfica e categorias de violência.",
    pdfFn: generateInstitucionalPDF,
    csvType: "institucional",
  },
  {
    id: "municipio",
    nome: "Relatório por município",
    descricao: "Detalhamento por município com ranking e resumo por UF.",
    pdfFn: generateMunicipioPDF,
    csvType: "municipio",
  },
  {
    id: "conformidade",
    nome: "Relatório de conformidade",
    descricao: "Verificação de cumprimento de SLAs, prazos de resposta e taxas de acionamento.",
    pdfFn: generateConformidadePDF,
    csvType: "conformidade",
  },
];

export default function AdminRelatorios() {
  const [period, setPeriod] = useState("90d");
  const [generating, setGenerating] = useState<string | null>(null);

  async function handleGenerate(report: ReportDef, format: "pdf" | "csv") {
    const key = `${report.id}-${format}`;
    setGenerating(key);
    try {
      if (format === "pdf") {
        await report.pdfFn(period);
      } else {
        await exportCSV(report.csvType, period);
      }
      toast.success(`${report.nome} (${format.toUpperCase()}) gerado com sucesso`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao gerar relatório: ${err.message}`);
    }
    setGenerating(null);
  }

  return (
    <div style={fontStyle}>
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Relatórios</p>
        <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Relatórios</h1>
        <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>
          Exporte relatórios agregados em PDF ou CSV com dados do período selecionado
        </p>
      </div>

      {/* Period selector */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-md border"
        style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}
      >
        <span className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Período:</span>
        {["7d", "30d", "90d", "12m"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-3 py-1.5 text-xs rounded border transition-colors"
            style={{
              borderColor: period === p ? "hsl(224 76% 33%)" : "hsl(220 13% 91%)",
              background: period === p ? "hsl(224 76% 33%)" : "transparent",
              color: period === p ? "#fff" : "hsl(220 9% 46%)",
              fontWeight: period === p ? 600 : 400,
            }}
          >
            {{ "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", "12m": "12 meses" }[p]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {reports.map((r) => (
          <div
            key={r.id}
            className="rounded-md border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{
              background: "hsl(0 0% 100%)",
              borderColor: "hsl(220 13% 91%)",
              boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)",
            }}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div
                className="w-9 h-9 rounded flex items-center justify-center shrink-0"
                style={{ background: "hsl(224 76% 33% / 0.08)" }}
              >
                <FileText className="w-4 h-4" style={{ color: "hsl(224 76% 33%)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{r.nome}</p>
                <p className="text-xs mt-0.5" style={{ color: "hsl(220 9% 46%)" }}>{r.descricao}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleGenerate(r, "pdf")}
                disabled={generating !== null}
                className="px-4 py-2 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
              >
                {generating === `${r.id}-pdf` ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                PDF
              </button>
              <button
                onClick={() => handleGenerate(r, "csv")}
                disabled={generating !== null}
                className="px-4 py-2 rounded border text-xs font-medium transition-colors flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
              >
                {generating === `${r.id}-csv` ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                CSV
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div
        className="mt-6 rounded-md border p-4 text-xs"
        style={{ background: "hsl(210 17% 96%)", borderColor: "hsl(220 13% 91%)", color: "hsl(220 9% 46%)" }}
      >
        <p className="font-medium mb-1" style={{ color: "hsl(220 13% 18%)" }}>Sobre os relatórios</p>
        <p>
          Todos os relatórios são gerados com dados agregados e anonimizados. Os PDFs incluem cabeçalho
          institucional, tabelas detalhadas e rodapé com aviso de conformidade LGPD.
          As exportações CSV podem ser importadas em ferramentas de análise como Excel ou Google Sheets.
        </p>
      </div>
    </div>
  );
}
