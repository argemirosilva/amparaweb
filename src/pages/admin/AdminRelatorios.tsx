import { useState, useEffect, useCallback } from "react";
import { FileText, Download, Loader2, Filter, BarChart3, MapPin, AlertTriangle, Mic, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  generateInstitucionalPDF,
  generateMunicipioPDF,
  generateAlertasPDF,
  generateMonitoramentoPDF,
  exportCSV,
} from "@/services/pdfReportService";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const TABS = [
  { id: "institucional", label: "Institucional", icon: BarChart3 },
  { id: "municipio", label: "Municípios", icon: MapPin },
  { id: "alertas", label: "Alertas", icon: AlertTriangle },
  { id: "monitoramento", label: "Monitoramento", icon: Mic },
] as const;

type TabId = typeof TABS[number]["id"];

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
      <p className="text-xs" style={{ color: "hsl(220 9% 46%)" }}>{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: "hsl(220 13% 18%)" }}>{value}</p>
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-xs" style={{ color: "hsl(220 9% 46%)" }}>
        Nenhum dado encontrado para os filtros selecionados
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-semibold border-b" style={{ color: "hsl(220 13% 18%)", borderColor: "hsl(220 13% 91%)", background: "hsl(210 17% 98%)" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-gray-50/60">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 border-b" style={{ borderColor: "hsl(220 13% 93%)", color: ci === 0 ? "hsl(220 13% 18%)" : "hsl(220 9% 46%)" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminRelatorios() {
  const [activeTab, setActiveTab] = useState<TabId>("institucional");
  const [period, setPeriod] = useState("90d");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // Filters
  const [filterUF, setFilterUF] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRisco, setFilterRisco] = useState("");

  // Data
  const [instData, setInstData] = useState<any>(null);
  const [munData, setMunData] = useState<any>(null);
  const [alertData, setAlertData] = useState<any>(null);
  const [monData, setMonData] = useState<any>(null);

  const getPeriodDays = (p: string) => ({ "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[p] || 30);
  const sinceDate = new Date(Date.now() - getPeriodDays(period) * 86400000).toISOString();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "institucional") {
        const [
          { count: totalUsuarias },
          { count: totalEventos },
          { count: totalEmergencias },
          { data: analises },
          { data: usuarios },
          { data: alertas },
        ] = await Promise.all([
          supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("status", "ativo"),
          supabase.from("gravacoes_analises").select("*", { count: "exact", head: true }).gte("created_at", sinceDate),
          supabase.from("alertas_panico").select("*", { count: "exact", head: true }).gte("criado_em", sinceDate),
          supabase.from("gravacoes_analises").select("nivel_risco, categorias, created_at").gte("created_at", sinceDate),
          supabase.from("usuarios").select("endereco_uf, status").eq("status", "ativo"),
          supabase.from("alertas_panico").select("user_id, status, criado_em").gte("criado_em", sinceDate),
        ]);

        const riskCounts: Record<string, number> = {};
        (analises || []).forEach((a) => { riskCounts[a.nivel_risco || "indefinido"] = (riskCounts[a.nivel_risco || "indefinido"] || 0) + 1; });
        const catCounts: Record<string, number> = {};
        (analises || []).forEach((a) => { ((a.categorias as string[]) || []).forEach((c) => { catCounts[c] = (catCounts[c] || 0) + 1; }); });
        const ufCounts: Record<string, number> = {};
        (usuarios || []).forEach((u) => { if (u.endereco_uf) ufCounts[u.endereco_uf] = (ufCounts[u.endereco_uf] || 0) + 1; });

        setInstData({
          totalUsuarias: totalUsuarias || 0,
          totalEventos: totalEventos || 0,
          totalEmergencias: totalEmergencias || 0,
          cancelados: (alertas || []).filter((a) => a.status === "cancelado").length,
          riskCounts,
          catCounts,
          ufCounts,
          ufs: Object.keys(ufCounts).sort(),
        });
      }

      if (activeTab === "municipio") {
        const [{ data: usuarios }, { data: analises }, { data: alertas }] = await Promise.all([
          supabase.from("usuarios").select("id, endereco_uf, endereco_cidade, status").eq("status", "ativo"),
          supabase.from("gravacoes_analises").select("user_id, nivel_risco, created_at").gte("created_at", sinceDate),
          supabase.from("alertas_panico").select("user_id, criado_em").gte("criado_em", sinceDate),
        ]);

        const userMap: Record<string, { uf: string; cidade: string }> = {};
        (usuarios || []).forEach((u) => { if (u.endereco_uf && u.endereco_cidade) userMap[u.id] = { uf: u.endereco_uf, cidade: u.endereco_cidade }; });

        type CityData = { uf: string; cidade: string; monitoradas: number; eventos: number; emergencias: number };
        const cityMap: Record<string, CityData> = {};
        (usuarios || []).forEach((u) => {
          if (!u.endereco_uf || !u.endereco_cidade) return;
          const key = `${u.endereco_cidade}-${u.endereco_uf}`;
          if (!cityMap[key]) cityMap[key] = { uf: u.endereco_uf, cidade: u.endereco_cidade, monitoradas: 0, eventos: 0, emergencias: 0 };
          cityMap[key].monitoradas++;
        });
        (analises || []).forEach((a) => { const info = userMap[a.user_id]; if (info) { const key = `${info.cidade}-${info.uf}`; if (cityMap[key]) cityMap[key].eventos++; } });
        (alertas || []).forEach((a) => { const info = userMap[a.user_id]; if (info) { const key = `${info.cidade}-${info.uf}`; if (cityMap[key]) cityMap[key].emergencias++; } });

        const cities = Object.values(cityMap).sort((a, b) => b.eventos - a.eventos);
        const ufs = [...new Set(cities.map((c) => c.uf))].sort();
        setMunData({ cities, ufs });
      }

      if (activeTab === "alertas") {
        const [{ data: alertas }, { count: totalUsuarias }] = await Promise.all([
          supabase.from("alertas_panico").select("*").gte("criado_em", sinceDate).order("criado_em", { ascending: false }),
          supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("status", "ativo"),
        ]);
        setAlertData({ alertas: alertas || [], totalUsuarias: totalUsuarias || 0 });
      }

      if (activeTab === "monitoramento") {
        const [
          { data: sessoes, count: totalSessoes },
          { data: gravacoes, count: totalGravacoes },
          { count: totalAnalises },
          { data: segmentos },
        ] = await Promise.all([
          supabase.from("monitoramento_sessoes").select("*", { count: "exact" }).gte("created_at", sinceDate).order("created_at", { ascending: false }),
          supabase.from("gravacoes").select("*", { count: "exact" }).gte("created_at", sinceDate).order("created_at", { ascending: false }),
          supabase.from("gravacoes_analises").select("*", { count: "exact", head: true }).gte("created_at", sinceDate),
          supabase.from("gravacoes_segmentos").select("duracao_segundos, tamanho_mb").gte("created_at", sinceDate),
        ]);
        setMonData({ sessoes: sessoes || [], totalSessoes: totalSessoes || 0, gravacoes: gravacoes || [], totalGravacoes: totalGravacoes || 0, totalAnalises: totalAnalises || 0, segmentos: segmentos || [] });
      }
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
    }
    setLoading(false);
  }, [activeTab, sinceDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const pdfFns: Record<TabId, (p: string) => Promise<void>> = {
    institucional: generateInstitucionalPDF,
    municipio: generateMunicipioPDF,
    alertas: generateAlertasPDF,
    monitoramento: generateMonitoramentoPDF,
  };

  async function handleExport(fmt: "pdf" | "csv") {
    const key = `${activeTab}-${fmt}`;
    setGenerating(key);
    try {
      if (fmt === "pdf") await pdfFns[activeTab](period);
      else await exportCSV(activeTab, period);
      toast.success(`Relatório exportado com sucesso`);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setGenerating(null);
  }

  // ---- RENDER SECTIONS ----

  function renderInstitucional() {
    if (!instData) return null;
    const d = instData;
    const riskTotal = Object.values(d.riskCounts as Record<string, number>).reduce((a: number, b: number) => a + b, 0) || 1;
    let riskRows = Object.entries(d.riskCounts as Record<string, number>)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([level, count]) => [level.charAt(0).toUpperCase() + level.slice(1), count as number, `${(((count as number) / riskTotal) * 100).toFixed(1)}%`]);
    if (filterRisco) riskRows = riskRows.filter((r) => (r[0] as string).toLowerCase().includes(filterRisco.toLowerCase()));

    let ufRows = Object.entries(d.ufCounts as Record<string, number>)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([uf, count]) => [uf, count as number]);
    if (filterUF) ufRows = ufRows.filter((r) => (r[0] as string) === filterUF);

    const catRows = Object.entries(d.catCounts as Record<string, number>)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 15)
      .map(([cat, count]) => [cat.charAt(0).toUpperCase() + cat.slice(1), count as number]);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Monitoradas Ativas" value={d.totalUsuarias} />
          <KpiCard label="Eventos no Período" value={d.totalEventos} />
          <KpiCard label="Emergências" value={d.totalEmergencias} />
          <KpiCard label="Alertas Cancelados" value={d.cancelados} />
        </div>

        {/* Risk Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} />
          <span className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Filtros:</span>
          <select value={filterRisco} onChange={(e) => setFilterRisco(e.target.value)} className="text-xs border rounded px-2 py-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
            <option value="">Todos os riscos</option>
            {Object.keys(d.riskCounts).map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <select value={filterUF} onChange={(e) => setFilterUF(e.target.value)} className="text-xs border rounded px-2 py-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
            <option value="">Todos os estados</option>
            {(d.ufs as string[]).map((uf: string) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>

        <Section title="Distribuição por Nível de Risco">
          <DataTable head={["Nível", "Quantidade", "Percentual"]} rows={riskRows} />
        </Section>

        <Section title="Distribuição Geográfica (UF)">
          <DataTable head={["UF", "Monitoradas Ativas"]} rows={ufRows} />
        </Section>

        <Section title="Categorias de Violência Mais Frequentes">
          <DataTable head={["Categoria", "Ocorrências"]} rows={catRows} />
        </Section>
      </div>
    );
  }

  function renderMunicipio() {
    if (!munData) return null;
    let cities = munData.cities as { uf: string; cidade: string; monitoradas: number; eventos: number; emergencias: number }[];
    if (filterUF) cities = cities.filter((c) => c.uf === filterUF);

    const ufSummary: Record<string, { monitoradas: number; eventos: number; emergencias: number }> = {};
    cities.forEach((c) => {
      if (!ufSummary[c.uf]) ufSummary[c.uf] = { monitoradas: 0, eventos: 0, emergencias: 0 };
      ufSummary[c.uf].monitoradas += c.monitoradas;
      ufSummary[c.uf].eventos += c.eventos;
      ufSummary[c.uf].emergencias += c.emergencias;
    });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard label="Municípios" value={cities.length} />
          <KpiCard label="Total Monitoradas" value={cities.reduce((a, c) => a + c.monitoradas, 0)} />
          <KpiCard label="Total Eventos" value={cities.reduce((a, c) => a + c.eventos, 0)} />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} />
          <select value={filterUF} onChange={(e) => setFilterUF(e.target.value)} className="text-xs border rounded px-2 py-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
            <option value="">Todos os estados</option>
            {(munData.ufs as string[]).map((uf: string) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </div>

        <Section title="Ranking de Municípios">
          <DataTable
            head={["Município", "UF", "Monitoradas", "Eventos", "Emergências"]}
            rows={cities.map((c) => [c.cidade, c.uf, c.monitoradas, c.eventos, c.emergencias])}
          />
        </Section>

        <Section title="Resumo por UF">
          <DataTable
            head={["UF", "Monitoradas", "Eventos", "Emergências"]}
            rows={Object.entries(ufSummary).sort(([, a], [, b]) => b.eventos - a.eventos).map(([uf, d]) => [uf, d.monitoradas, d.eventos, d.emergencias])}
          />
        </Section>
      </div>
    );
  }

  function renderAlertas() {
    if (!alertData) return null;
    let alertas = alertData.alertas as any[];
    if (filterStatus) alertas = alertas.filter((a: any) => a.status === filterStatus);

    const total = alertas.length;
    const cancelados = alertas.filter((a: any) => a.status === "cancelado").length;
    const comGPS = alertas.filter((a: any) => a.latitude && a.longitude).length;
    const comGuardioes = alertas.filter((a: any) => a.guardioes_notificados).length;
    const comAutoridades = alertas.filter((a: any) => a.autoridades_acionadas).length;
    const canceladosJanela = alertas.filter((a: any) => a.cancelado_dentro_janela).length;

    const tipoAcionamento: Record<string, number> = {};
    alertas.forEach((a: any) => { tipoAcionamento[a.tipo_acionamento || "não informado"] = (tipoAcionamento[a.tipo_acionamento || "não informado"] || 0) + 1; });

    const tempos = alertas.filter((a: any) => a.tempo_ate_cancelamento_segundos != null).map((a: any) => a.tempo_ate_cancelamento_segundos);
    const tempoMedio = tempos.length ? (tempos.reduce((a: number, b: number) => a + b, 0) / tempos.length).toFixed(0) + "s" : "—";

    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const porDia = [0, 0, 0, 0, 0, 0, 0];
    alertas.forEach((a: any) => { porDia[new Date(a.criado_em).getDay()]++; });

    const statuses = [...new Set(alertData.alertas.map((a: any) => a.status))].sort();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total de Alertas" value={total} />
          <KpiCard label="Cancelados" value={cancelados} />
          <KpiCard label="Tempo Médio Cancel." value={tempoMedio} />
          <KpiCard label="Usuárias Ativas" value={alertData.totalUsuarias} />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs border rounded px-2 py-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
            <option value="">Todos os status</option>
            {statuses.map((s: string) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Guardiões Notificados" value={`${comGuardioes} (${total ? ((comGuardioes / total) * 100).toFixed(0) : 0}%)`} />
          <KpiCard label="Autoridades Acionadas" value={`${comAutoridades} (${total ? ((comAutoridades / total) * 100).toFixed(0) : 0}%)`} />
          <KpiCard label="Com GPS" value={`${comGPS} (${total ? ((comGPS / total) * 100).toFixed(0) : 0}%)`} />
          <KpiCard label="Cancel. na Janela" value={canceladosJanela} />
        </div>

        <Section title="Alertas por Tipo de Acionamento">
          <DataTable
            head={["Tipo", "Quantidade", "Percentual"]}
            rows={Object.entries(tipoAcionamento).sort(([, a], [, b]) => b - a).map(([tipo, count]) => [tipo.charAt(0).toUpperCase() + tipo.slice(1), count, `${((count / (total || 1)) * 100).toFixed(1)}%`])}
          />
        </Section>

        <Section title="Distribuição por Dia da Semana">
          <DataTable
            head={["Dia", "Alertas", "Percentual"]}
            rows={diasSemana.map((dia, i) => [dia, porDia[i], `${((porDia[i] / (total || 1)) * 100).toFixed(1)}%`])}
          />
        </Section>

        <Section title="Últimos Alertas">
          <DataTable
            head={["Data", "Status", "Tipo", "Guardiões", "Autoridades", "GPS"]}
            rows={alertas.slice(0, 50).map((a: any) => [
              format(new Date(a.criado_em), "dd/MM/yy HH:mm", { locale: ptBR }),
              a.status,
              a.tipo_acionamento || "—",
              a.guardioes_notificados ? "Sim" : "Não",
              a.autoridades_acionadas ? "Sim" : "Não",
              a.latitude ? "Sim" : "Não",
            ])}
          />
        </Section>
      </div>
    );
  }

  function renderMonitoramento() {
    if (!monData) return null;
    const { sessoes, totalSessoes, gravacoes, totalGravacoes, totalAnalises, segmentos } = monData;

    let filteredGravacoes = gravacoes as any[];
    if (filterStatus) filteredGravacoes = filteredGravacoes.filter((g: any) => g.status === filterStatus);

    const totalDuracao = (sessoes as any[]).reduce((acc: number, s: any) => acc + (s.total_duration_seconds || 0), 0);
    const totalMB = (segmentos as any[]).reduce((acc: number, s: any) => acc + (s.tamanho_mb || 0), 0);
    const coberturaIA = totalGravacoes > 0 ? ((totalAnalises / totalGravacoes) * 100).toFixed(1) : "0";

    const statusCount: Record<string, number> = {};
    (gravacoes as any[]).forEach((g: any) => { statusCount[g.status] = (statusCount[g.status] || 0) + 1; });

    const origemCount: Record<string, number> = {};
    (sessoes as any[]).forEach((s: any) => { origemCount[s.origem || "não informada"] = (origemCount[s.origem || "não informada"] || 0) + 1; });

    const gravStatuses = [...new Set((gravacoes as any[]).map((g: any) => g.status))].sort();

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total Sessões" value={totalSessoes} />
          <KpiCard label="Total Gravações" value={totalGravacoes} />
          <KpiCard label="Cobertura IA" value={`${coberturaIA}%`} />
          <KpiCard label="Duração Total" value={`${(totalDuracao / 3600).toFixed(1)}h`} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard label="Análises IA" value={totalAnalises} />
          <KpiCard label="Volume de Áudio" value={`${totalMB.toFixed(1)} MB`} />
          <KpiCard label="Total Segmentos" value={(sessoes as any[]).reduce((acc: number, s: any) => acc + (s.total_segments || 0), 0)} />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" style={{ color: "hsl(220 9% 46%)" }} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-xs border rounded px-2 py-1" style={{ borderColor: "hsl(220 13% 91%)" }}>
            <option value="">Todos os status</option>
            {gravStatuses.map((s: string) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>

        <Section title="Status das Gravações">
          <DataTable
            head={["Status", "Quantidade", "Percentual"]}
            rows={Object.entries(statusCount).sort(([, a], [, b]) => b - a).map(([s, c]) => [s.charAt(0).toUpperCase() + s.slice(1), c, `${((c / (totalGravacoes || 1)) * 100).toFixed(1)}%`])}
          />
        </Section>

        <Section title="Sessões por Origem">
          <DataTable
            head={["Origem", "Quantidade"]}
            rows={Object.entries(origemCount).sort(([, a], [, b]) => b - a).map(([o, c]) => [o.charAt(0).toUpperCase() + o.slice(1), c])}
          />
        </Section>

        <Section title="Últimas Gravações">
          <DataTable
            head={["Data", "Status", "Duração", "Tamanho"]}
            rows={filteredGravacoes.slice(0, 50).map((g: any) => [
              format(new Date(g.created_at), "dd/MM/yy HH:mm", { locale: ptBR }),
              g.status,
              g.duracao_segundos ? `${Math.round(g.duracao_segundos)}s` : "—",
              g.tamanho_mb ? `${g.tamanho_mb.toFixed(1)} MB` : "—",
            ])}
          />
        </Section>
      </div>
    );
  }

  const renderers: Record<TabId, () => React.ReactNode> = {
    institucional: renderInstitucional,
    municipio: renderMunicipio,
    alertas: renderAlertas,
    monitoramento: renderMonitoramento,
  };

  // Reset filters when changing tabs
  useEffect(() => { setFilterUF(""); setFilterStatus(""); setFilterRisco(""); }, [activeTab]);

  return (
    <div style={fontStyle}>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs mb-1" style={{ color: "hsl(220 9% 46%)" }}>Admin &gt; Relatórios</p>
          <h1 className="text-xl font-semibold" style={{ color: "hsl(220 13% 18%)" }}>Relatórios</h1>
          <p className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Visualize dados agregados com filtros e exporte em PDF ou CSV</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => handleExport("pdf")}
            disabled={generating !== null || loading}
            className="px-4 py-2 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: "hsl(224 76% 33%)", color: "#fff" }}
          >
            {generating?.endsWith("-pdf") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar PDF
          </button>
          <button
            onClick={() => handleExport("csv")}
            disabled={generating !== null || loading}
            className="px-4 py-2 rounded border text-xs font-medium transition-colors flex items-center gap-1.5 hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: "hsl(224 76% 33%)", color: "hsl(224 76% 33%)" }}
          >
            {generating?.endsWith("-csv") ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Period + Tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
          <span className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Período:</span>
          {["7d", "30d", "90d", "12m"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1 text-xs rounded transition-colors"
              style={{
                background: period === p ? "hsl(224 76% 33%)" : "transparent",
                color: period === p ? "#fff" : "hsl(220 9% 46%)",
                fontWeight: period === p ? 600 : 400,
              }}
            >
              {{ "7d": "7 dias", "30d": "30 dias", "90d": "90 dias", "12m": "12 meses" }[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: "hsl(220 13% 91%)" }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px"
              style={{
                borderColor: isActive ? "hsl(224 76% 33%)" : "transparent",
                color: isActive ? "hsl(224 76% 33%)" : "hsl(220 9% 46%)",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "hsl(224 76% 33%)" }} />
          <span className="ml-2 text-sm" style={{ color: "hsl(220 9% 46%)" }}>Carregando dados...</span>
        </div>
      ) : (
        renderers[activeTab]()
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border overflow-hidden" style={{ background: "hsl(0 0% 100%)", borderColor: "hsl(220 13% 91%)" }}>
      <div className="px-4 py-2.5 border-b" style={{ borderColor: "hsl(220 13% 91%)", background: "hsl(210 17% 98%)" }}>
        <h3 className="text-xs font-semibold" style={{ color: "hsl(220 13% 18%)" }}>{title}</h3>
      </div>
      <div className="p-0">{children}</div>
    </div>
  );
}
