import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ConsultaResultado {
  consulta_id?: string;
  vitima_vinculada?: { nome?: string } | null;
  agressor_vinculado?: { nome?: string } | null;
  ampara_summary?: any;
  resultados?: {
    analitico?: { analise?: any; error?: string };
    despacho?: { texto?: string; error?: string };
    parecer?: { texto?: string; error?: string };
  };
}

const MARGIN = 15;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + needed > pageHeight - MARGIN) {
    pdf.addPage();
    return MARGIN;
  }
  return y;
}

function addTitle(pdf: jsPDF, text: string, y: number): number {
  y = ensureSpace(pdf, y, 12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 30);
  pdf.text(text, MARGIN, y);
  return y + 7;
}

function addSubtitle(pdf: jsPDF, text: string, y: number): number {
  y = ensureSpace(pdf, y, 9);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(60, 60, 60);
  pdf.text(text, MARGIN, y);
  return y + 5;
}

function addParagraph(pdf: jsPDF, text: string, y: number, fontSize = 10): number {
  if (!text) return y;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(40, 40, 40);
  const lines = pdf.splitTextToSize(text, CONTENT_WIDTH);
  for (const line of lines) {
    y = ensureSpace(pdf, y, 5);
    pdf.text(line, MARGIN, y);
    y += fontSize === 10 ? 5 : 4.5;
  }
  return y + 2;
}

function addLine(pdf: jsPDF, y: number): number {
  y = ensureSpace(pdf, y, 5);
  pdf.setDrawColor(200);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  return y + 4;
}

function addHeader(pdf: jsPDF, consulta: ConsultaResultado) {
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, PAGE_WIDTH, 22, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text("AMPARA Tribunal — Relatório Consolidado", MARGIN, 10);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    `Consulta: ${consulta.consulta_id?.substring(0, 8) || "—"}  |  Gerado em ${new Date().toLocaleString("pt-BR")}`,
    MARGIN,
    16,
  );
}

function addFooter(pdf: jsPDF) {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.text(
      `Documento técnico-indicativo · Página ${i} de ${total}`,
      PAGE_WIDTH / 2,
      pageHeight - 7,
      { align: "center" },
    );
  }
}

function nivelLabel(n?: string): string {
  if (!n) return "—";
  return n.replace("_", " ");
}

export function generateTribunalPdf(consulta: ConsultaResultado) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  addHeader(pdf, consulta);
  let y = 28;

  // Identificação
  y = addTitle(pdf, "Identificação", y);
  if (consulta.vitima_vinculada?.nome) {
    y = addParagraph(pdf, `Vítima: ${consulta.vitima_vinculada.nome}`, y);
  } else {
    y = addParagraph(pdf, "Vítima: não identificada", y);
  }
  if (consulta.agressor_vinculado?.nome) {
    y = addParagraph(pdf, `Agressor: ${consulta.agressor_vinculado.nome}`, y);
  } else {
    y = addParagraph(pdf, "Agressor: não identificado", y);
  }
  y = addLine(pdf, y);

  // Dados AMPARA (resumo)
  if (consulta.ampara_summary) {
    const s = consulta.ampara_summary;
    y = addTitle(pdf, "Dados Obtidos do AMPARA", y);
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Indicador", "Total"]],
      body: [
        ["Análises MICRO", String(s.total_analises_micro ?? 0)],
        ["Relatórios MACRO", String(s.total_relatorios_macro ?? 0)],
        ["Avaliações de Risco", String(s.total_avaliacoes_risco ?? 0)],
        ["Gravações processadas", String(s.total_gravacoes ?? 0)],
        ["Dados externos anteriores", String(s.total_dados_externos ?? 0)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
      theme: "grid",
    });
    y = (pdf as any).lastAutoTable.finalY + 5;

    if (s.avaliacoes_risco?.length > 0) {
      y = addSubtitle(pdf, "Avaliações de risco recentes", y);
      autoTable(pdf, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Data", "Nível", "Score", "Tendência"]],
        body: s.avaliacoes_risco.slice(0, 5).map((r: any) => [
          new Date(r.data).toLocaleDateString("pt-BR"),
          nivelLabel(r.nivel),
          String(r.score ?? "—"),
          `${r.tendencia ?? "—"}${r.percentual_tendencia != null ? ` (${r.percentual_tendencia > 0 ? "+" : ""}${r.percentual_tendencia}%)` : ""}`,
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] },
        theme: "striped",
      });
      y = (pdf as any).lastAutoTable.finalY + 5;
    }
    y = addLine(pdf, y);
  }

  // ANALÍTICO
  pdf.addPage();
  y = MARGIN;
  y = addTitle(pdf, "Análise Analítica", y);
  const analitico = consulta.resultados?.analitico?.analise;
  if (consulta.resultados?.analitico?.error) {
    y = addParagraph(pdf, `Erro: ${consulta.resultados.analitico.error}`, y);
  } else if (analitico) {
    if (analitico.score_risco != null || analitico.nivel_risco) {
      y = addParagraph(
        pdf,
        `Score: ${analitico.score_risco ?? "—"}  |  Nível: ${nivelLabel(analitico.nivel_risco)}  |  Confiança: ${analitico.confianca != null ? Math.round(analitico.confianca * 100) + "%" : "—"}`,
        y,
      );
    }
    if (analitico.ciclo_violencia) {
      y = addParagraph(
        pdf,
        `Ciclo: ${nivelLabel(analitico.ciclo_violencia.fase_atual)} · Tendência: ${analitico.ciclo_violencia.tendencia ?? "—"}`,
        y,
      );
    }
    if (analitico.resumo_tecnico) {
      y = addSubtitle(pdf, "Resumo técnico", y);
      y = addParagraph(pdf, analitico.resumo_tecnico, y);
    }

    if (analitico.cruzamento_dados?.length > 0) {
      y = addSubtitle(pdf, "Cruzamento com registros AMPARA", y);
      autoTable(pdf, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Status", "Magistrado informou", "Registro AMPARA", "Observação"]],
        body: analitico.cruzamento_dados.map((c: any) => [
          c.status ?? "—",
          c.informacao_magistrado ?? "",
          c.registro_ampara ?? "",
          c.observacao ?? "",
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42] },
        columnStyles: { 0: { cellWidth: 22 } },
        theme: "grid",
      });
      y = (pdf as any).lastAutoTable.finalY + 5;
    }

    if (analitico.indicadores?.length > 0) {
      y = addSubtitle(pdf, "Indicadores", y);
      autoTable(pdf, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Nome", "Presente", "Peso", "Evidência"]],
        body: analitico.indicadores.map((i: any) => [
          i.nome ?? "",
          i.presente ? "Sim" : "Não",
          String(i.peso ?? "—"),
          i.evidencia ?? "",
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42] },
        theme: "striped",
      });
      y = (pdf as any).lastAutoTable.finalY + 5;
    }

    if (analitico.fatores_risco?.length > 0) {
      y = addSubtitle(pdf, "Fatores de risco", y);
      autoTable(pdf, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Gravidade", "Fator", "Fonte"]],
        body: analitico.fatores_risco.map((f: any) => [
          f.gravidade ?? "",
          f.fator ?? "",
          f.fonte ?? "",
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42] },
        theme: "striped",
      });
      y = (pdf as any).lastAutoTable.finalY + 5;
    }

    if (analitico.padroes_identificados?.length > 0) {
      y = addSubtitle(pdf, "Padrões identificados", y);
      autoTable(pdf, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["Padrão", "Frequência", "Descrição"]],
        body: analitico.padroes_identificados.map((p: any) => [
          p.padrao ?? "",
          p.frequencia ?? "",
          p.descricao ?? "",
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42] },
        theme: "striped",
      });
      y = (pdf as any).lastAutoTable.finalY + 5;
    }

    if (analitico.recomendacoes_tecnicas?.length > 0) {
      y = addSubtitle(pdf, "Recomendações técnicas", y);
      for (let i = 0; i < analitico.recomendacoes_tecnicas.length; i++) {
        y = addParagraph(pdf, `${i + 1}. ${analitico.recomendacoes_tecnicas[i]}`, y);
      }
    }
  }

  // DESPACHO
  pdf.addPage();
  y = MARGIN;
  y = addTitle(pdf, "Despacho Institucional", y);
  if (consulta.resultados?.despacho?.error) {
    y = addParagraph(pdf, `Erro: ${consulta.resultados.despacho.error}`, y);
  } else if (consulta.resultados?.despacho?.texto) {
    y = addParagraph(pdf, consulta.resultados.despacho.texto, y);
  }

  // PARECER
  pdf.addPage();
  y = MARGIN;
  y = addTitle(pdf, "Parecer Técnico", y);
  if (consulta.resultados?.parecer?.error) {
    y = addParagraph(pdf, `Erro: ${consulta.resultados.parecer.error}`, y);
  } else if (consulta.resultados?.parecer?.texto) {
    y = addParagraph(pdf, consulta.resultados.parecer.texto, y);
  }

  addFooter(pdf);
  pdf.save(`ampara-tribunal-${consulta.consulta_id?.substring(0, 8) || "relatorio"}.pdf`);
}
