import { useEffect, useState } from "react";
import {
  fetchRilDashboardDirect,
  fetchRilReport,
  triggerRilConsolidate,
  recomputeMetricsForWindow,
  type RilDashboard,
  type RilWindow,
} from "@/services/rilService";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Brain,
  FileText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

const WINDOW_OPTIONS: Array<{ value: RilWindow; label: string }> = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "120", label: "Últimos 120 dias" },
  { value: "365", label: "Último ano" },
  { value: "1095", label: "Últimos 3 anos" },
  { value: "all", label: "Toda a base" },
];

function pct(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export default function AdminInteligenciaRisco() {
  const [data, setData] = useState<RilDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<string>("");
  const [reportLoading, setReportLoading] = useState(false);
  const [windowSel, setWindowSel] = useState<RilWindow>("all");

  async function load(w: RilWindow = windowSel) {
    setLoading(true);
    try {
      const d = await fetchRilDashboardDirect(w);
      setData(d);
    } catch (e) {
      toast.error("Falha ao carregar inteligência de risco");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function gerarRelatorio() {
    setReportLoading(true);
    try {
      const r = await fetchRilReport(windowSel);
      setReport(r.report);
    } catch {
      toast.error("Falha ao gerar relatório");
    } finally {
      setReportLoading(false);
    }
  }

  async function reprocessar() {
    toast.info("Reprocessando snapshots e indicadores em todas as janelas…");
    try {
      await triggerRilConsolidate();
      toast.success("Atualização concluída");
      await load();
    } catch {
      toast.error("Falha ao reprocessar");
    }
  }

  async function recalcularJanela() {
    toast.info(`Recalculando métricas para ${labelFor(windowSel)}…`);
    try {
      await recomputeMetricsForWindow(windowSel);
      toast.success("Métricas atualizadas");
      await load();
    } catch {
      toast.error("Falha ao recalcular");
    }
  }

  function labelFor(w: RilWindow) {
    return WINDOW_OPTIONS.find((o) => o.value === w)?.label ?? w;
  }

  useEffect(() => {
    load(windowSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowSel]);

  const m = data?.metrics;
  const dist = m?.distribuicao_risco ?? {};
  const corr = m?.correlacao_ampara_fonar ?? {};
  const totalFonar = (dist.moderado ?? 0) + (dist.grave ?? 0) + (dist.extremo ?? 0);
  const pctGrave = totalFonar > 0
    ? (((dist.grave ?? 0) + (dist.extremo ?? 0)) / totalFonar * 100).toFixed(1)
    : "0.0";

  const distChart = [
    { nivel: "Moderado", valor: dist.moderado ?? 0 },
    { nivel: "Grave", valor: dist.grave ?? 0 },
    { nivel: "Extremo", valor: dist.extremo ?? 0 },
  ];

  return (
    <div className="space-y-6" style={fontStyle}>
      <AdminPageHeader
        icon={Brain}
        breadcrumb="Inteligência"
        title="Inteligência de Risco"
        description="Camada interpretativa que correlaciona o risco do motor AMPARA com a autoavaliação FONAR. Indicadores agregados e anonimizados (k-anonymity ≥ 5) para uso institucional."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={windowSel} onValueChange={(v) => setWindowSel(v as RilWindow)}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={recalcularJanela}>
              <RefreshCw className="w-4 h-4 mr-2" /> Recalcular janela
            </Button>
            <Button variant="outline" size="sm" onClick={reprocessar}>
              <RefreshCw className="w-4 h-4 mr-2" /> Reprocessar tudo
            </Button>
            <Button size="sm" onClick={gerarRelatorio} disabled={reportLoading}>
              <FileText className="w-4 h-4 mr-2" /> Gerar relatório
            </Button>
          </div>
        }
      />

      {loading && (
        <p className="text-sm text-muted-foreground">Carregando indicadores…</p>
      )}

      {!loading && !m && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Ainda não há indicadores computados para <strong>{labelFor(windowSel)}</strong>. Clique em
            <em> "Recalcular janela"</em> para gerar a análise agora.
          </p>
        </Card>
      )}

      {!loading && m && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              label="Amostras no período"
              value={String(m.total_amostras)}
              hint={`${labelFor(windowSel)} · ${new Date(m.period_start).toLocaleDateString("pt-BR")} → ${new Date(m.period_end).toLocaleDateString("pt-BR")}`}
              icon={<Activity className="w-4 h-4" />}
            />
            <KpiCard
              label="% em risco grave/extremo (FONAR)"
              value={`${pctGrave}%`}
              hint="Autoavaliação"
              icon={<AlertTriangle className="w-4 h-4" />}
              tone="warning"
            />
            <KpiCard
              label="Taxa de escalada"
              value={pct(m.taxa_escalada)}
              hint="Casos com tendência subindo"
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <KpiCard
              label="Convergência AMPARA × FONAR"
              value={`${corr.convergencia ?? 0} / ${corr.divergencia ?? 0}`}
              hint="Convergem / Divergem"
              icon={<ShieldCheck className="w-4 h-4" />}
            />
          </div>

          {/* Série temporal + Distribuição */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-4">Evolução diária — {labelFor(windowSel)}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.serie_temporal ?? []}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#g1)" name="Snapshots" />
                    <Area type="monotone" dataKey="urgente" stroke="hsl(var(--destructive))" fill="url(#g2)" name="Urgentes" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Distribuição de risco (FONAR)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nivel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Indicadores secundários */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              label="Taxa de recorrência"
              value={pct(m.taxa_recorrencia)}
              hint="Casos com fatores reincidentes"
              icon={<ArrowUpRight className="w-4 h-4" />}
            />
            <KpiCard
              label="Atualização do FONAR"
              value={pct(m.taxa_atualizacao_fonar)}
              hint="Cobertura no período"
              icon={<ShieldCheck className="w-4 h-4" />}
            />
            <KpiCard
              label="Subnotificação indireta"
              value={pct(m.indicador_subnotificacao)}
              hint="Alto AMPARA sem FONAR"
              icon={<AlertTriangle className="w-4 h-4" />}
              tone="warning"
            />
          </div>

          {/* Fatores mais comuns + Eventos críticos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Principais fatores observados</h3>
              {m.fatores_mais_comuns.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>
              ) : (
                <ul className="space-y-2">
                  {m.fatores_mais_comuns.slice(0, 8).map((f, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{f.fator}</span>
                      <Badge variant="secondary">{f.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Alertas estratégicos recentes</h3>
              {(data?.critical_events ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum alerta crítico no período.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-auto">
                  {(data?.critical_events ?? []).slice(0, 12).map((e, i) => (
                    <li key={i} className="flex items-start justify-between text-xs border-b border-border pb-2">
                      <div>
                        <p className="font-medium text-foreground">{e.event_type.replace(/_/g, " ")}</p>
                        <p className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <Badge variant="destructive">{e.severity}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Relatório executivo */}
          {report && (
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Relatório executivo · {labelFor(windowSel)}
              </h3>
              <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                {report}
              </pre>
            </Card>
          )}

          <p className="text-xs text-muted-foreground">
            Os indicadores apresentados são agregados e anonimizados. Nenhuma
            informação individual identificável é exposta. Aplica-se k-anonymity
            mínimo de {m.k_anonymity_min} amostras por agrupamento.
          </p>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "warning";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={
            tone === "warning"
              ? "text-destructive"
              : "text-muted-foreground"
          }
        >
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );
}
