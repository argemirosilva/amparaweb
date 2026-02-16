const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const sections = [
  {
    title: "O que é mostrado",
    content:
      "Dados agregados sobre volume de eventos, distribuição geográfica e tendências temporais. Todas as métricas são calculadas a partir de registros consolidados por região e período, sem qualquer referência a casos individuais.",
  },
  {
    title: "O que não é mostrado",
    content:
      "Nenhuma informação que possa identificar vítimas, agressores ou terceiros envolvidos. Dados como nomes, endereços, telefones, características físicas e quaisquer elementos de identificação individual são excluídos.",
  },
  {
    title: "Regra de anonimização (K mínimo)",
    content:
      "Aplicamos K-anonimato com K ≥ 5. Isso significa que qualquer dado apresentado se refere a, no mínimo, 5 registros distintos. Regiões ou períodos com menos de 5 registros são suprimidos para evitar reidentificação.",
  },
  {
    title: "Atraso temporal",
    content:
      "Todos os dados são apresentados com atraso mínimo de 48 horas em relação ao registro original. Esse intervalo protege as vítimas, impedindo que informações recentes sejam usadas para rastreamento ou retaliação.",
  },
  {
    title: "LGPD e proteção de dados",
    content:
      "O tratamento dos dados segue integralmente a Lei Geral de Proteção de Dados (Lei 13.709/2018). O acesso aos dados brutos é restrito a operadores autorizados, com registro completo em trilha de auditoria. A finalidade do painel é exclusivamente institucional e de transparência pública.",
  },
];

export default function TransparenciaMetodologia() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10" style={fontStyle}>
      <h1 className="text-2xl font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
        Metodologia
      </h1>
      <p className="text-sm mb-8" style={{ color: "hsl(220 9% 46%)" }}>
        Como os dados são tratados, anonimizados e apresentados neste painel.
      </p>

      <div className="space-y-6">
        {sections.map((s, i) => (
          <section
            key={i}
            className="rounded-md border p-5"
            style={{
              background: "hsl(0 0% 100%)",
              borderColor: "hsl(220 13% 91%)",
              boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.06)",
            }}
          >
            <h2 className="text-base font-semibold mb-2" style={{ color: "hsl(220 13% 18%)" }}>
              {s.title}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "hsl(220 9% 46%)" }}>
              {s.content}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
