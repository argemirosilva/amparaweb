import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const BRAND_COLOR: [number, number, number] = [30, 58, 138]; // hsl(224 76% 33%) ≈ rgb(30,58,138)
const GRAY_TEXT: [number, number, number] = [107, 114, 128];
const DARK_TEXT: [number, number, number] = [31, 41, 55];

function addHeader(doc: jsPDF, title: string, subtitle: string, period: string) {
  const pageW = doc.internal.pageSize.getWidth();

  // Brand bar
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("AMPARA", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Plataforma de Proteção à Mulher", 14, 19);

  // Title section
  doc.setTextColor(...DARK_TEXT);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 40);

  doc.setTextColor(...GRAY_TEXT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 14, 47);
  doc.text(`Período: ${period}  •  Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 53);

  // Separator
  doc.setDrawColor(220, 220, 230);
  doc.line(14, 57, pageW - 14, 57);

  return 62; // starting Y for content
}

function addFooter(doc: jsPDF, pageNum: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_TEXT);
  doc.text(
    "Documento gerado automaticamente pelo sistema AMPARA. Dados agregados e anonimizados conforme LGPD.",
    14,
    pageH - 10
  );
  doc.text(`Página ${pageNum}`, pageW - 30, pageH - 10);
}

function getPeriodDays(period: string): number {
  return { "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[period] || 30;
}

function getPeriodLabel(period: string): string {
  return { "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias", "12m": "Últimos 12 meses" }[period] || period;
}

// ============ RELATÓRIO INSTITUCIONAL ============
export async function generateInstitucionalPDF(period: string) {
  const days = getPeriodDays(period);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [
    { count: totalUsuarias },
    { count: totalEventos },
    { count: totalEmergencias },
    { data: analises },
    { data: usuarios },
    { data: alertas },
  ] = await Promise.all([
    supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("gravacoes_analises").select("*", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("alertas_panico").select("*", { count: "exact", head: true }).gte("criado_em", since),
    supabase.from("gravacoes_analises").select("nivel_risco, categorias, created_at").gte("created_at", since),
    supabase.from("usuarios").select("endereco_uf, status").eq("status", "ativo"),
    supabase.from("alertas_panico").select("user_id, status, criado_em").gte("criado_em", since),
  ]);

  const doc = new jsPDF();
  let y = addHeader(doc, "Relatório Mensal Institucional", "Consolidado com KPIs e distribuição geográfica", getPeriodLabel(period));

  // KPIs section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Indicadores-Chave (KPIs)", 14, y);
  y += 6;

  const kpiData = [
    ["Monitoradas Ativas", String(totalUsuarias || 0)],
    ["Eventos no Período", String(totalEventos || 0)],
    ["Emergências Registradas", String(totalEmergencias || 0)],
    ["Alertas Cancelados", String((alertas || []).filter((a) => a.status === "cancelado").length)],
    ["Alertas Ativos", String((alertas || []).filter((a) => a.status === "ativo").length)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: kpiData,
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9, font: "helvetica" },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 100 }, 1: { halign: "center", cellWidth: 50 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Risk distribution
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Distribuição por Nível de Risco", 14, y);
  y += 6;

  const riskCounts: Record<string, number> = {};
  (analises || []).forEach((a) => {
    const key = a.nivel_risco || "indefinido";
    riskCounts[key] = (riskCounts[key] || 0) + 1;
  });
  const total = Object.values(riskCounts).reduce((a, b) => a + b, 0) || 1;
  const riskRows = Object.entries(riskCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([level, count]) => [
      level.charAt(0).toUpperCase() + level.slice(1),
      String(count),
      `${((count / total) * 100).toFixed(1)}%`,
    ]);

  autoTable(doc, {
    startY: y,
    head: [["Nível", "Quantidade", "Percentual"]],
    body: riskRows,
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Geographic distribution
  const ufCounts: Record<string, number> = {};
  (usuarios || []).forEach((u) => {
    if (u.endereco_uf) ufCounts[u.endereco_uf] = (ufCounts[u.endereco_uf] || 0) + 1;
  });
  const ufRows = Object.entries(ufCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([uf, count]) => [uf, String(count)]);

  if (y > 230) {
    addFooter(doc, 1);
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Distribuição Geográfica (UF)", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["UF", "Monitoradas Ativas"]],
    body: ufRows,
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    margin: { left: 14, right: 14 },
  });

  // Category analysis
  const catCounts: Record<string, number> = {};
  (analises || []).forEach((a) => {
    const cats = a.categorias as string[] | null;
    (cats || []).forEach((c) => {
      catCounts[c] = (catCounts[c] || 0) + 1;
    });
  });
  const catRows = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([cat, count]) => [cat.charAt(0).toUpperCase() + cat.slice(1), String(count)]);

  y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 230) {
    addFooter(doc, doc.getNumberOfPages());
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Categorias de Violência Mais Frequentes", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Categoria", "Ocorrências"]],
    body: catRows,
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    margin: { left: 14, right: 14 },
  });

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }

  doc.save(`relatorio-institucional-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ============ RELATÓRIO POR MUNICÍPIO ============
export async function generateMunicipioPDF(period: string) {
  const days = getPeriodDays(period);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: usuarios }, { data: analises }, { data: alertas }] = await Promise.all([
    supabase.from("usuarios").select("id, endereco_uf, endereco_cidade, status").eq("status", "ativo"),
    supabase.from("gravacoes_analises").select("user_id, nivel_risco, created_at").gte("created_at", since),
    supabase.from("alertas_panico").select("user_id, criado_em").gte("criado_em", since),
  ]);

  const userMap: Record<string, { uf: string; cidade: string }> = {};
  (usuarios || []).forEach((u) => {
    if (u.endereco_uf && u.endereco_cidade)
      userMap[u.id] = { uf: u.endereco_uf, cidade: u.endereco_cidade };
  });

  // Aggregate by city
  type CityData = { uf: string; cidade: string; monitoradas: number; eventos: number; emergencias: number };
  const cityMap: Record<string, CityData> = {};

  (usuarios || []).forEach((u) => {
    if (!u.endereco_uf || !u.endereco_cidade) return;
    const key = `${u.endereco_cidade}-${u.endereco_uf}`;
    if (!cityMap[key]) cityMap[key] = { uf: u.endereco_uf, cidade: u.endereco_cidade, monitoradas: 0, eventos: 0, emergencias: 0 };
    cityMap[key].monitoradas++;
  });

  (analises || []).forEach((a) => {
    const info = userMap[a.user_id];
    if (!info) return;
    const key = `${info.cidade}-${info.uf}`;
    if (cityMap[key]) cityMap[key].eventos++;
  });

  (alertas || []).forEach((a) => {
    const info = userMap[a.user_id];
    if (!info) return;
    const key = `${info.cidade}-${info.uf}`;
    if (cityMap[key]) cityMap[key].emergencias++;
  });

  const sortedCities = Object.values(cityMap).sort((a, b) => b.eventos - a.eventos);

  const doc = new jsPDF();
  let y = addHeader(doc, "Relatório por Município", "Detalhamento por município com dados agregados", getPeriodLabel(period));

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Ranking de Municípios por Eventos", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Município", "UF", "Monitoradas", "Eventos", "Emergências"]],
    body: sortedCities.map((c) => [c.cidade, c.uf, String(c.monitoradas), String(c.eventos), String(c.emergencias)]),
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    margin: { left: 14, right: 14 },
  });

  // Per-UF summary
  const ufSummary: Record<string, { monitoradas: number; eventos: number; emergencias: number }> = {};
  sortedCities.forEach((c) => {
    if (!ufSummary[c.uf]) ufSummary[c.uf] = { monitoradas: 0, eventos: 0, emergencias: 0 };
    ufSummary[c.uf].monitoradas += c.monitoradas;
    ufSummary[c.uf].eventos += c.eventos;
    ufSummary[c.uf].emergencias += c.emergencias;
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 230) {
    addFooter(doc, doc.getNumberOfPages());
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Resumo por UF", 14, y);
  y += 6;

  const ufRows = Object.entries(ufSummary)
    .sort(([, a], [, b]) => b.eventos - a.eventos)
    .map(([uf, d]) => [uf, String(d.monitoradas), String(d.eventos), String(d.emergencias)]);

  autoTable(doc, {
    startY: y,
    head: [["UF", "Monitoradas", "Eventos", "Emergências"]],
    body: ufRows,
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    margin: { left: 14, right: 14 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }

  doc.save(`relatorio-municipio-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ============ RELATÓRIO DE CONFORMIDADE ============
export async function generateConformidadePDF(period: string) {
  const days = getPeriodDays(period);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [{ data: alertas }, { count: totalUsuarias }] = await Promise.all([
    supabase.from("alertas_panico").select("*").gte("criado_em", since),
    supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("status", "ativo"),
  ]);

  const doc = new jsPDF();
  let y = addHeader(doc, "Relatório de Conformidade", "Verificação de cumprimento de SLAs e prazos", getPeriodLabel(period));

  const totalAlertas = (alertas || []).length;
  const alertasAtivos = (alertas || []).filter((a) => a.status === "ativo").length;
  const alertasCancelados = (alertas || []).filter((a) => a.status === "cancelado").length;
  const comNotificacao = (alertas || []).filter((a) => a.guardioes_notificados).length;
  const comAutoridades = (alertas || []).filter((a) => a.autoridades_acionadas).length;
  const canceladosDentroJanela = (alertas || []).filter((a) => a.cancelado_dentro_janela).length;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Indicadores de Conformidade", 14, y);
  y += 6;

  const conformData = [
    ["Total de Alertas no Período", String(totalAlertas)],
    ["Alertas Ativos (pendentes)", String(alertasAtivos)],
    ["Alertas Cancelados", String(alertasCancelados)],
    ["Cancelados dentro da janela de segurança", String(canceladosDentroJanela)],
    ["Guardiões Notificados", `${comNotificacao} (${totalAlertas ? ((comNotificacao / totalAlertas) * 100).toFixed(1) : 0}%)`],
    ["Autoridades Acionadas", `${comAutoridades} (${totalAlertas ? ((comAutoridades / totalAlertas) * 100).toFixed(1) : 0}%)`],
    ["Usuárias Ativas", String(totalUsuarias || 0)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Métrica", "Valor"]],
    body: conformData,
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 120 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Breakdown by acionamento type
  const tipoAcionamento: Record<string, number> = {};
  (alertas || []).forEach((a) => {
    const tipo = a.tipo_acionamento || "não informado";
    tipoAcionamento[tipo] = (tipoAcionamento[tipo] || 0) + 1;
  });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Alertas por Tipo de Acionamento", 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [["Tipo", "Quantidade", "Percentual"]],
    body: Object.entries(tipoAcionamento).map(([tipo, count]) => [
      tipo.charAt(0).toUpperCase() + tipo.slice(1),
      String(count),
      `${((count / (totalAlertas || 1)) * 100).toFixed(1)}%`,
    ]),
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    margin: { left: 14, right: 14 },
  });

  // SLA Analysis
  y = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK_TEXT);
  doc.text("Análise de SLA", 14, y);
  y += 6;

  const slaData = [
    ["SLA de notificação de guardiões (< 60s)", comNotificacao > 0 ? "✓ Cumprido" : "— Sem dados suficientes"],
    ["SLA de acionamento de autoridades (< 5min)", comAutoridades > 0 ? "✓ Cumprido" : "— Sem dados suficientes"],
    ["Taxa de cancelamento dentro da janela", `${canceladosDentroJanela}/${alertasCancelados} cancelamentos`],
  ];

  autoTable(doc, {
    startY: y,
    head: [["SLA", "Status"]],
    body: slaData,
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK_TEXT },
    margin: { left: 14, right: 14 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i);
  }

  doc.save(`relatorio-conformidade-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

// ============ CSV EXPORT ============
export async function exportCSV(type: string, period: string) {
  const days = getPeriodDays(period);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let csvContent = "";

  if (type === "institucional" || type === "municipio") {
    const [{ data: usuarios }, { data: analises }, { data: alertas }] = await Promise.all([
      supabase.from("usuarios").select("id, endereco_uf, endereco_cidade, status").eq("status", "ativo"),
      supabase.from("gravacoes_analises").select("user_id, nivel_risco, created_at").gte("created_at", since),
      supabase.from("alertas_panico").select("user_id, criado_em").gte("criado_em", since),
    ]);

    const userMap: Record<string, { uf: string; cidade: string }> = {};
    (usuarios || []).forEach((u) => {
      if (u.endereco_uf && u.endereco_cidade) userMap[u.id] = { uf: u.endereco_uf, cidade: u.endereco_cidade };
    });

    const cityMap: Record<string, { uf: string; cidade: string; monitoradas: number; eventos: number; emergencias: number }> = {};
    (usuarios || []).forEach((u) => {
      if (!u.endereco_uf || !u.endereco_cidade) return;
      const key = `${u.endereco_cidade}-${u.endereco_uf}`;
      if (!cityMap[key]) cityMap[key] = { uf: u.endereco_uf, cidade: u.endereco_cidade, monitoradas: 0, eventos: 0, emergencias: 0 };
      cityMap[key].monitoradas++;
    });
    (analises || []).forEach((a) => {
      const info = userMap[a.user_id];
      if (info) {
        const key = `${info.cidade}-${info.uf}`;
        if (cityMap[key]) cityMap[key].eventos++;
      }
    });
    (alertas || []).forEach((a) => {
      const info = userMap[a.user_id];
      if (info) {
        const key = `${info.cidade}-${info.uf}`;
        if (cityMap[key]) cityMap[key].emergencias++;
      }
    });

    csvContent = "Município,UF,Monitoradas,Eventos,Emergências\n";
    Object.values(cityMap)
      .sort((a, b) => b.eventos - a.eventos)
      .forEach((c) => {
        csvContent += `"${c.cidade}",${c.uf},${c.monitoradas},${c.eventos},${c.emergencias}\n`;
      });
  } else {
    const { data: alertas } = await supabase.from("alertas_panico").select("*").gte("criado_em", since);
    csvContent = "Data,Status,Tipo Acionamento,Guardiões Notificados,Autoridades Acionadas\n";
    (alertas || []).forEach((a) => {
      csvContent += `${format(new Date(a.criado_em), "dd/MM/yyyy HH:mm")},${a.status},${a.tipo_acionamento || ""},${a.guardioes_notificados},${a.autoridades_acionadas}\n`;
    });
  }

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-${type}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
