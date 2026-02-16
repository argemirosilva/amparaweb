import { FileText, Download } from "lucide-react";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const reports = [
  { nome: "Relatório mensal institucional", descricao: "Consolidado mensal com KPIs e distribuição geográfica." },
  { nome: "Relatório por município", descricao: "Detalhamento por município com séries temporais." },
  { nome: "Relatório de conformidade", descricao: "Verificação de cumprimento de SLAs e prazos de resposta." },
  { nome: "Histórico de exportações", descricao: "Registro de todas as exportações realizadas." },
];

export default function AdminRelatorios() {
  return (
    <div style={fontStyle}>
      <div className="mb-6">
        <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Relatórios</p>
        <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Relatórios</h1>
      </div>

      <div className="space-y-4">
        {reports.map((r, i) => (
          <div
            key={i}
            className="rounded-md border p-4 flex items-center justify-between gap-4"
            style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: "hsl(224 76% 33% / 0.08)" }}>
                <FileText className="w-4 h-4" style={{ color: "hsl(224 76% 33%)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{r.nome}</p>
                <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>{r.descricao}</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
              >
                Gerar
              </button>
              <button
                className="px-3 py-1.5 rounded border text-xs font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
              >
                PDF
              </button>
              <button
                className="px-3 py-1.5 rounded border text-xs font-medium transition-colors hover:bg-gray-50"
                style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
              >
                CSV
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
