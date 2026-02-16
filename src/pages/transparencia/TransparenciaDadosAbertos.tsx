import { Download, FileText, FileJson, Calendar } from "lucide-react";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const datasets = [
  {
    nome: "Eventos agregados por município",
    descricao: "Volume mensal de eventos por município e nível de risco.",
    atualizado: "14/02/2026",
  },
  {
    nome: "Distribuição por UF",
    descricao: "Totais por unidade federativa, com séries temporais trimestrais.",
    atualizado: "14/02/2026",
  },
  {
    nome: "Tendências nacionais",
    descricao: "Métricas agregadas nacionais com comparativos inter-períodos.",
    atualizado: "14/02/2026",
  },
];

export default function TransparenciaDadosAbertos() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10" style={fontStyle}>
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
        Dados Abertos
      </h1>
      <p className="text-sm mb-8" style={{ color: "hsl(220 9% 46%)" }}>
        Datasets disponíveis para download em formatos abertos.
      </p>

      <div className="space-y-4 mb-8">
        {datasets.map((ds, i) => (
          <div
            key={i}
            className="rounded-md border p-4"
            style={{
              background: "hsl(0 0% 100%)",
              borderColor: "hsl(220 13% 91%)",
              boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-1" style={{ color: "hsl(220 13% 18%)" }}>
                  {ds.nome}
                </h3>
                <p className="text-xs mb-2" style={{ color: "hsl(220 9% 46%)" }}>
                  {ds.descricao}
                </p>
                <div className="flex items-center gap-1 text-xs" style={{ color: "hsl(220 9% 46%)" }}>
                  <Calendar className="w-3 h-3" />
                  Atualizado em {ds.atualizado}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded border text-xs font-medium transition-colors hover:bg-gray-50"
                  style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
                >
                  <FileText className="w-3 h-3" />
                  CSV
                </button>
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded border text-xs font-medium transition-colors hover:bg-gray-50"
                  style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
                >
                  <FileJson className="w-3 h-3" />
                  JSON
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Termo de uso */}
      <section
        className="rounded-md border p-4 text-xs"
        style={{
          background: "hsl(210 17% 96%)",
          borderColor: "hsl(220 13% 91%)",
          color: "hsl(220 9% 46%)",
        }}
      >
        <p className="font-semibold mb-1" style={{ color: "hsl(220 13% 18%)" }}>
          Termo de uso
        </p>
        <p>
          Os dados são disponibilizados sob licença aberta para fins de pesquisa, jornalismo e
          controle social. É vedada a utilização para tentativa de reidentificação de indivíduos.
          O uso dos dados implica aceite integral destes termos.
        </p>
      </section>
    </div>
  );
}
