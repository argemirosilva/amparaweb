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

// ============= Layout constants =============
const MARGIN = 15;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Paleta inspirada no tema (slate / primary)
const C_PRIMARY: [number, number, number] = [15, 23, 42];      // slate-900
const C_PRIMARY_SOFT: [number, number, number] = [241, 245, 249]; // slate-100
const C_BORDER: [number, number, number] = [226, 232, 240];     // slate-200
const C_MUTED: [number, number, number] = [100, 116, 139];      // slate-500
const C_TEXT: [number, number, number] = [30, 41, 59];          // slate-800
const C_ACCENT: [number, number, number] = [37, 99, 235];       // blue-600

const C_RISK = {
  critico: [220, 38, 38] as [number, number, number],
  alto: [234, 88, 12] as [number, number, number],
  moderado: [202, 138, 4] as [number, number, number],
  sem_risco: [22, 163, 74] as [number, number, number],
  default: [100, 116, 139] as [number, number, number],
};

function riskColor(nivel?: string): [number, number, number] {
  if (!nivel) return C_RISK.default;
  const n = nivel.toLowerCase();
  if (n.includes("critic")) return C_RISK.critico;
  if (n === "alto" || n === "alta") return C_RISK.alto;
  if (n === "moderado" || n === "media" || n === "média") return C_RISK.moderado;
  if (n.includes("sem") || n === "baixa" || n === "baixo") return C_RISK.sem_risco;
  return C_RISK.default;
}

function nivelLabel(n?: string): string {
  if (!n) return "—";
  return n.replace(/_/g, " ");
}

// ============= Page primitives =============
function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - 18) {
    pdf.addPage();
    return MARGIN + 4;
  }
  return y;
}

function setText(pdf: jsPDF, color: [number, number, number], size: number, weight: "normal" | "bold" = "normal") {
  pdf.setTextColor(color[0], color[1], color[2]);
  pdf.setFontSize(size);
  pdf.setFont("helvetica", weight);
}

// ============= Cover page =============
function addCover(pdf: jsPDF, consulta: ConsultaResultado) {
  // Fundo escuro
  pdf.setFillColor(...C_PRIMARY);
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  // Faixa accent
  pdf.setFillColor(...C_ACCENT);
  pdf.rect(0, 0, PAGE_WIDTH, 4, "F");

  // Logo / marca
  setText(pdf, [255, 255, 255], 9, "bold");
  pdf.setCharSpace(2);
  pdf.text("AMPARA · TRIBUNAL", MARGIN, 30);
  pdf.setCharSpace(0);

  // Título principal
  setText(pdf, [255, 255, 255], 28, "bold");
  pdf.text("Relatório de", MARGIN, 90);
  pdf.text("Consulta", MARGIN, 102);

  setText(pdf, [148, 163, 184], 14, "normal");
  pdf.text("Análise técnica consolidada", MARGIN, 114);

  // Linha divisora
  pdf.setDrawColor(71, 85, 105);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, 130, MARGIN + 60, 130);

  // Bloco de identificação
  let y = 145;
  setText(pdf, [148, 163, 184], 8, "bold");
  pdf.setCharSpace(1.5);
  pdf.text("VÍTIMA", MARGIN, y);
  pdf.setCharSpace(0);
  setText(pdf, [255, 255, 255], 13, "normal");
  pdf.text(consulta.vitima_vinculada?.nome || "Não identificada", MARGIN, y + 7);

  y += 20;
  setText(pdf, [148, 163, 184], 8, "bold");
  pdf.setCharSpace(1.5);
  pdf.text("AGRESSOR", MARGIN, y);
  pdf.setCharSpace(0);
  setText(pdf, [255, 255, 255], 13, "normal");
  pdf.text(consulta.agressor_vinculado?.nome || "Não identificado", MARGIN, y + 7);

  // Score de risco em destaque (se existir)
  const analitico = consulta.resultados?.analitico?.analise;
  if (analitico?.score_risco != null || analitico?.nivel_risco) {
    const cor = riskColor(analitico.nivel_risco);
    const boxY = 195;
    pdf.setFillColor(cor[0], cor[1], cor[2]);
    pdf.roundedRect(MARGIN, boxY, CONTENT_WIDTH, 38, 2, 2, "F");

    setText(pdf, [255, 255, 255], 8, "bold");
    pdf.setCharSpace(1.5);
    pdf.text("AVALIAÇÃO DE RISCO", MARGIN + 8, boxY + 10);
    pdf.setCharSpace(0);

    setText(pdf, [255, 255, 255], 32, "bold");
    pdf.text(String(analitico.score_risco ?? "—"), MARGIN + 8, boxY + 30);

    setText(pdf, [255, 255, 255], 9, "normal");
    pdf.text("score", MARGIN + 8 + pdf.getTextWidth(String(analitico.score_risco ?? "—")) + 3, boxY + 30);

    setText(pdf, [255, 255, 255], 14, "bold");
    const nivelTxt = nivelLabel(analitico.nivel_risco).toUpperCase();
    pdf.text(nivelTxt, PAGE_WIDTH - MARGIN - 8, boxY + 22, { align: "right" });

    if (analitico.confianca != null) {
      setText(pdf, [255, 255, 255], 9, "normal");
      pdf.text(`Confiança ${Math.round(analitico.confianca * 100)}%`, PAGE_WIDTH - MARGIN - 8, boxY + 30, { align: "right" });
    }
  }

  // Rodapé da capa
  setText(pdf, [148, 163, 184], 8, "normal");
  pdf.text(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`, MARGIN, PAGE_HEIGHT - 25);
  pdf.text(
    `Consulta nº ${consulta.consulta_id?.substring(0, 8).toUpperCase() || "—"}`,
    MARGIN,
    PAGE_HEIGHT - 18,
  );

  setText(pdf, [100, 116, 139], 7, "normal");
  pdf.text("Documento técnico-indicativo · Uso restrito", PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 18, { align: "right" });
}

// ============= Internal page header =============
function addPageHeader(pdf: jsPDF, secao: string) {
  pdf.setFillColor(...C_PRIMARY_SOFT);
  pdf.rect(0, 0, PAGE_WIDTH, 16, "F");
  pdf.setDrawColor(...C_BORDER);
  pdf.setLineWidth(0.2);
  pdf.line(0, 16, PAGE_WIDTH, 16);

  setText(pdf, C_MUTED, 7, "bold");
  pdf.setCharSpace(1.2);
  pdf.text("AMPARA · TRIBUNAL", MARGIN, 10);
  pdf.setCharSpace(0);

  setText(pdf, C_TEXT, 9, "bold");
  pdf.text(secao, PAGE_WIDTH - MARGIN, 10, { align: "right" });
}

// ============= Section helpers =============
function startSection(pdf: jsPDF, titulo: string, subtitulo: string | null = null): number {
  let y = MARGIN + 14;

  // Eyebrow
  setText(pdf, C_ACCENT, 8, "bold");
  pdf.setCharSpace(1.5);
  pdf.text(subtitulo ? "SEÇÃO" : "RELATÓRIO", MARGIN, y);
  pdf.setCharSpace(0);

  // Título
  setText(pdf, C_PRIMARY, 22, "bold");
  pdf.text(titulo, MARGIN, y + 12);

  // Subtítulo
  if (subtitulo) {
    setText(pdf, C_MUTED, 10, "normal");
    pdf.text(subtitulo, MARGIN, y + 19);
    y += 27;
  } else {
    y += 18;
  }

  // Linha
  pdf.setDrawColor(...C_BORDER);
  pdf.setLineWidth(0.4);
  pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  return y + 8;
}

function sectionTitle(pdf: jsPDF, text: string, y: number): number {
  y = ensureSpace(pdf, y, 12);
  setText(pdf, C_ACCENT, 7, "bold");
  pdf.setCharSpace(1.2);
  pdf.text("◆", MARGIN, y);
  pdf.setCharSpace(0);
  setText(pdf, C_PRIMARY, 12, "bold");
  pdf.text(text, MARGIN + 5, y);
  return y + 6;
}

function paragraph(pdf: jsPDF, text: string, y: number, opts?: { size?: number; color?: [number, number, number]; bg?: boolean }): number {
  if (!text) return y;
  const size = opts?.size ?? 10;
  const color = opts?.color ?? C_TEXT;
  setText(pdf, color, size, "normal");
  const lines = pdf.splitTextToSize(text, CONTENT_WIDTH - (opts?.bg ? 8 : 0));
  const lineHeight = size * 0.45;
  const totalHeight = lines.length * lineHeight + (opts?.bg ? 6 : 0);
  y = ensureSpace(pdf, y, totalHeight + 2);

  if (opts?.bg) {
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(...C_BORDER);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(MARGIN, y - 4, CONTENT_WIDTH, totalHeight + 2, 1.5, 1.5, "FD");
    setText(pdf, color, size, "normal");
    let yy = y;
    for (const line of lines) {
      pdf.text(line, MARGIN + 4, yy);
      yy += lineHeight;
    }
    return y + totalHeight + 2;
  }

  for (const line of lines) {
    y = ensureSpace(pdf, y, lineHeight);
    pdf.text(line, MARGIN, y);
    y += lineHeight;
  }
  return y + 2;
}

// Card horizontal de KPI no estilo do header analítico
function kpiBar(pdf: jsPDF, items: { label: string; value: string; color?: [number, number, number] }[], y: number): number {
  const h = 22;
  y = ensureSpace(pdf, y, h + 4);

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(...C_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN, y, CONTENT_WIDTH, h, 2, 2, "FD");

  const colW = CONTENT_WIDTH / items.length;
  items.forEach((it, i) => {
    const x = MARGIN + i * colW;
    if (i > 0) {
      pdf.setDrawColor(...C_BORDER);
      pdf.line(x, y + 4, x, y + h - 4);
    }
    setText(pdf, C_MUTED, 6.5, "bold");
    pdf.setCharSpace(0.8);
    pdf.text(it.label.toUpperCase(), x + colW / 2, y + 7, { align: "center" });
    pdf.setCharSpace(0);
    setText(pdf, it.color || C_PRIMARY, 13, "bold");
    pdf.text(it.value, x + colW / 2, y + 16, { align: "center" });
  });

  return y + h + 6;
}

// Block de info (grid 2 colunas estilo "Vítima | Agressor")
function partyCard(pdf: jsPDF, x: number, y: number, w: number, label: string, nome: string, accent: [number, number, number]): number {
  const h = 20;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(...C_BORDER);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, h, 2, 2, "FD");

  // Barra lateral colorida
  pdf.setFillColor(accent[0], accent[1], accent[2]);
  pdf.roundedRect(x, y, 1.5, h, 0.5, 0.5, "F");

  setText(pdf, C_MUTED, 7, "bold");
  pdf.setCharSpace(1.2);
  pdf.text(label.toUpperCase(), x + 5, y + 7);
  pdf.setCharSpace(0);

  setText(pdf, C_PRIMARY, 11, "bold");
  const nomeLines = pdf.splitTextToSize(nome, w - 8);
  pdf.text(nomeLines[0] || "—", x + 5, y + 14);

  return y + h;
}

// ============= Footer =============
function addFooter(pdf: jsPDF) {
  const total = pdf.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    pdf.setPage(i);
    setText(pdf, C_MUTED, 7, "normal");
    pdf.setDrawColor(...C_BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 12);
    pdf.text("AMPARA · Documento técnico-indicativo", MARGIN, PAGE_HEIGHT - 7);
    pdf.text(`Página ${i} de ${total}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, { align: "right" });
  }
}

// ============= Sections =============
function renderIdentificacao(pdf: jsPDF, consulta: ConsultaResultado) {
  pdf.addPage();
  addPageHeader(pdf, "Identificação");
  let y = startSection(pdf, "Partes Identificadas", "Resumo das partes envolvidas na consulta");

  // Cards de vítima e agressor lado a lado
  const cardW = (CONTENT_WIDTH - 4) / 2;
  partyCard(pdf, MARGIN, y, cardW, "Vítima", consulta.vitima_vinculada?.nome || "Não identificada", C_ACCENT);
  partyCard(pdf, MARGIN + cardW + 4, y, cardW, "Agressor", consulta.agressor_vinculado?.nome || "Não identificado", [220, 38, 38]);
  y += 26;

  // Resumo AMPARA
  const s = consulta.ampara_summary;
  if (s) {
    y = sectionTitle(pdf, "Dados consolidados do AMPARA", y);
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
      styles: { fontSize: 9, cellPadding: 3, textColor: C_TEXT, lineColor: C_BORDER, lineWidth: 0.2 },
      headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold", cellWidth: 30 } },
      theme: "grid",
    });
    y = (pdf as any).lastAutoTable.finalY + 6;

    if (s.avaliacoes_risco?.length > 0) {
      y = sectionTitle(pdf, "Avaliações de risco recentes", y);
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
        styles: { fontSize: 9, cellPadding: 3, textColor: C_TEXT, lineColor: C_BORDER, lineWidth: 0.2 },
        headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: "grid",
      });
    }
  }
}

function renderAnalitico(pdf: jsPDF, consulta: ConsultaResultado) {
  pdf.addPage();
  addPageHeader(pdf, "Análise Analítica");
  let y = startSection(pdf, "Análise Analítica", "Cruzamento estruturado de dados, indicadores e fatores de risco");

  if (consulta.resultados?.analitico?.error) {
    y = paragraph(pdf, `Erro: ${consulta.resultados.analitico.error}`, y, { color: [220, 38, 38], bg: true });
    return;
  }

  const a = consulta.resultados?.analitico?.analise;
  if (!a) {
    y = paragraph(pdf, "Nenhum dado analítico disponível.", y, { color: C_MUTED });
    return;
  }

  // KPI bar
  const cor = riskColor(a.nivel_risco);
  y = kpiBar(pdf, [
    { label: "Score", value: String(a.score_risco ?? "—"), color: cor },
    { label: "Nível", value: nivelLabel(a.nivel_risco), color: cor },
    { label: "Confiança", value: a.confianca != null ? `${Math.round(a.confianca * 100)}%` : "—" },
    { label: "Ciclo", value: a.ciclo_violencia?.fase_atual ? nivelLabel(a.ciclo_violencia.fase_atual) : "—" },
  ], y);

  if (a.resumo_tecnico) {
    y = sectionTitle(pdf, "Resumo Técnico", y);
    y = paragraph(pdf, a.resumo_tecnico, y, { bg: true });
    y += 2;
  }

  if (a.cruzamento_dados?.length > 0) {
    y = sectionTitle(pdf, "Cruzamento com registros AMPARA", y);
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Status", "Magistrado informou", "Registro AMPARA", "Observação"]],
      body: a.cruzamento_dados.map((c: any) => [
        nivelLabel(c.status),
        c.informacao_magistrado ?? "",
        c.registro_ampara ?? "",
        c.observacao ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: C_TEXT, lineColor: C_BORDER, lineWidth: 0.2, valign: "top" },
      headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 24, fontStyle: "bold" } },
      theme: "grid",
    });
    y = (pdf as any).lastAutoTable.finalY + 6;
  }

  if (a.indicadores?.length > 0) {
    y = sectionTitle(pdf, "Indicadores", y);
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Indicador", "Presente", "Peso", "Evidência"]],
      body: a.indicadores.map((i: any) => [
        i.nome ?? "",
        i.presente ? "Sim" : "Não",
        String(i.peso ?? "—"),
        i.evidencia ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: C_TEXT, lineColor: C_BORDER, lineWidth: 0.2, valign: "top" },
      headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 14, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          if (data.cell.raw === "Sim") {
            data.cell.styles.textColor = [234, 88, 12];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      theme: "grid",
    });
    y = (pdf as any).lastAutoTable.finalY + 6;
  }

  if (a.fatores_risco?.length > 0) {
    y = sectionTitle(pdf, "Fatores de risco", y);
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Gravidade", "Fator", "Fonte"]],
      body: a.fatores_risco.map((f: any) => [
        nivelLabel(f.gravidade) ?? "",
        f.fator ?? "",
        f.fonte ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: C_TEXT, lineColor: C_BORDER, lineWidth: 0.2, valign: "top" },
      headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 24, fontStyle: "bold" }, 2: { cellWidth: 30 } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const v = String(data.cell.raw || "").toLowerCase();
          const c = riskColor(v);
          data.cell.styles.textColor = c;
        }
      },
      theme: "grid",
    });
    y = (pdf as any).lastAutoTable.finalY + 6;
  }

  if (a.padroes_identificados?.length > 0) {
    y = sectionTitle(pdf, "Padrões identificados", y);
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Padrão", "Frequência", "Descrição"]],
      body: a.padroes_identificados.map((p: any) => [
        p.padrao ?? "",
        p.frequencia ?? "",
        p.descricao ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: C_TEXT, lineColor: C_BORDER, lineWidth: 0.2, valign: "top" },
      headStyles: { fillColor: C_PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" }, 1: { cellWidth: 28 } },
      theme: "grid",
    });
    y = (pdf as any).lastAutoTable.finalY + 6;
  }

  if (a.recomendacoes_tecnicas?.length > 0) {
    y = sectionTitle(pdf, "Recomendações técnicas", y);
    for (let i = 0; i < a.recomendacoes_tecnicas.length; i++) {
      const num = `${i + 1}.`;
      const txt = a.recomendacoes_tecnicas[i];
      const lines = pdf.splitTextToSize(txt, CONTENT_WIDTH - 14);
      const h = lines.length * 4.5 + 4;
      y = ensureSpace(pdf, y, h + 2);

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(...C_BORDER);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(MARGIN, y - 3, CONTENT_WIDTH, h, 1.5, 1.5, "FD");

      setText(pdf, C_ACCENT, 11, "bold");
      pdf.text(num, MARGIN + 3, y + 2);

      setText(pdf, C_TEXT, 9, "normal");
      let yy = y + 2;
      for (const line of lines) {
        pdf.text(line, MARGIN + 12, yy);
        yy += 4.5;
      }
      y += h + 2;
    }
  }
}

function renderTextoLongo(pdf: jsPDF, consulta: ConsultaResultado, tipo: "despacho" | "parecer") {
  const titulos = {
    despacho: { titulo: "Despacho Institucional", sub: "Texto sugerido para fundamentação processual", header: "Despacho" },
    parecer: { titulo: "Parecer Técnico", sub: "Análise técnica fundamentada para apoio à decisão", header: "Parecer Técnico" },
  };
  const cfg = titulos[tipo];
  const r = consulta.resultados?.[tipo];

  pdf.addPage();
  addPageHeader(pdf, cfg.header);
  let y = startSection(pdf, cfg.titulo, cfg.sub);

  if (r?.error) {
    y = paragraph(pdf, `Erro: ${r.error}`, y, { color: [220, 38, 38], bg: true });
    return;
  }

  if (!r?.texto) {
    y = paragraph(pdf, "Nenhum conteúdo disponível.", y, { color: C_MUTED });
    return;
  }

  // Quebra em parágrafos preservando estrutura
  const blocos = r.texto.split(/\n{2,}/);
  for (const bloco of blocos) {
    const linhas = bloco.split("\n").map(l => l.trim()).filter(Boolean).join(" ");
    if (!linhas) continue;
    y = paragraph(pdf, linhas, y, { size: 10 });
    y += 2;
  }
}

// ============= Main entry =============
export function generateTribunalPdf(consulta: ConsultaResultado) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  // Página 1: Capa
  addCover(pdf, consulta);

  // Página 2: Identificação + dados AMPARA
  renderIdentificacao(pdf, consulta);

  // Análise analítica (se houver)
  if (consulta.resultados?.analitico) {
    renderAnalitico(pdf, consulta);
  }

  // Despacho (se houver)
  if (consulta.resultados?.despacho?.texto || consulta.resultados?.despacho?.error) {
    renderTextoLongo(pdf, consulta, "despacho");
  }

  // Parecer (se houver)
  if (consulta.resultados?.parecer?.texto || consulta.resultados?.parecer?.error) {
    renderTextoLongo(pdf, consulta, "parecer");
  }

  addFooter(pdf);
  pdf.save(`ampara-tribunal-${consulta.consulta_id?.substring(0, 8) || "relatorio"}.pdf`);
}
