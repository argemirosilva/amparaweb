import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Eye, FileJson, FileText, BookOpen, Copy, Download, User, UserX, Calendar, Hash, Database, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import TribunalAnaliticoView from "./TribunalAnaliticoView";
import { generateTribunalPdf } from "@/services/tribunalPdfService";

const MODO_LABELS: Record<string, string> = {
  analitico: "Analítico",
  despacho: "Despacho",
  parecer: "Parecer Técnico",
  todos: "Análise Completa",
};

const MODO_ICONS: Record<string, any> = {
  analitico: FileJson,
  despacho: FileText,
  parecer: BookOpen,
  todos: Database,
};

export default function TribunalConsultas() {
  const { sessionToken } = useAuth();
  const { toast } = useToast();
  const [consultas, setConsultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroModo, setFiltroModo] = useState<string>("todos_filtro");
  const [selected, setSelected] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchConsultas = async () => {
    setLoading(true);
    try {
      const body: any = { action: "listConsultas", session_token: sessionToken, limit: 50 };
      if (filtroModo !== "todos_filtro") body.modo_saida = filtroModo;

      const { data } = await supabase.functions.invoke("tribunal-api", { body });
      setConsultas(data?.consultas || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchDetail = async (id: string) => {
    setLoadingDetail(true);
    setDetailOpen(true);
    try {
      const { data } = await supabase.functions.invoke("tribunal-api", {
        body: { action: "getConsulta", session_token: sessionToken, consulta_id: id },
      });
      setSelected(data?.consulta || null);
    } catch (e) {
      console.error(e);
    }
    setLoadingDetail(false);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text || "");
    toast({ title: "Copiado", description: `${label} copiado para a área de transferência.` });
  };

  /**
   * Reconstrói o objeto consumido pelo gerador de PDF a partir do registro armazenado.
   * Suporta o formato novo (modo "todos" com output_json contendo analitico/despacho/parecer)
   * e o formato legado (1 modo por consulta).
   */
  const buildPdfPayload = (c: any) => {
    if (!c) return null;
    const ao = c.analysis_object || {};
    const dadosAmpara = ao.dados_ampara_registros || {};
    const dadosInput = ao.dados_magistrado_input || {};
    const vitimaSrc =
      dadosAmpara.vitima ||
      dadosInput.vitima ||
      (ao.dados_vitima && Object.keys(ao.dados_vitima).length > 0 ? ao.dados_vitima : null);
    const agressorSrc =
      dadosAmpara.agressor ||
      dadosInput.agressor ||
      (ao.dados_agressor && Object.keys(ao.dados_agressor).length > 0 ? ao.dados_agressor : null);

    const ampara_summary = ao.ampara_summary || dadosAmpara.ampara_summary || null;

    const resultados: any = {};
    if (c.modo_saida === "todos" && c.output_json) {
      resultados.analitico = { analise: c.output_json.analitico ?? null, error: c.output_json.analitico_error };
      resultados.despacho = { texto: c.output_json.despacho ?? "", error: c.output_json.despacho_error };
      resultados.parecer = { texto: c.output_json.parecer ?? "", error: c.output_json.parecer_error };
    } else {
      if (c.modo_saida === "analitico") resultados.analitico = { analise: c.output_json };
      if (c.modo_saida === "despacho") resultados.despacho = { texto: c.output_text };
      if (c.modo_saida === "parecer") resultados.parecer = { texto: c.output_text };
    }

    return {
      consulta_id: c.id,
      vitima_vinculada: vitimaSrc
        ? { nome: vitimaSrc.nome || vitimaSrc.nome_completo || (vitimaSrc.cidade_uf ? `Vítima · ${vitimaSrc.cidade_uf}` : "Vítima identificada") }
        : null,
      agressor_vinculado: agressorSrc
        ? { nome: agressorSrc.nome || (agressorSrc.cidade_uf ? `Agressor · ${agressorSrc.cidade_uf}` : "Agressor identificado") }
        : null,
      ampara_summary,
      resultados,
    };
  };

  useEffect(() => { fetchConsultas(); }, [filtroModo]);

  // Determina se a consulta selecionada possui as 3 análises (modo "todos") ou apenas uma
  const isCompleta = selected?.modo_saida === "todos" && selected?.output_json;

  // Para consultas antigas: despacho/parecer ficavam dentro de output_text como JSON serializado
  let legacyTextos: { despacho?: string; parecer?: string } = {};
  if (isCompleta && selected?.output_text && (!selected.output_json?.despacho || !selected.output_json?.parecer)) {
    try {
      const parsed = JSON.parse(selected.output_text);
      if (parsed && typeof parsed === "object") legacyTextos = parsed;
    } catch { /* output_text não é JSON */ }
  }

  const analiticoData = isCompleta ? selected.output_json.analitico : (selected?.modo_saida === "analitico" ? selected?.output_json : null);
  const despachoTexto = isCompleta
    ? (selected?.output_json?.despacho || legacyTextos.despacho || null)
    : (selected?.modo_saida === "despacho" ? selected?.output_text : null);
  const parecerTexto = isCompleta
    ? (selected?.output_json?.parecer || legacyTextos.parecer || null)
    : (selected?.modo_saida === "parecer" ? selected?.output_text : null);

  const ao = selected?.analysis_object || {};
  const dadosInput = ao.dados_magistrado_input || {};
  const dadosAmpara = ao.dados_ampara_registros || {};
  // Fallback para consultas antigas que salvavam dados_vitima/dados_agressor no nível raiz
  const vitimaInfo =
    dadosAmpara.vitima ||
    dadosInput.vitima ||
    (ao.dados_vitima && Object.keys(ao.dados_vitima).length > 0 ? ao.dados_vitima : null);
  const agressorInfo =
    dadosAmpara.agressor ||
    dadosInput.agressor ||
    (ao.dados_agressor && Object.keys(ao.dados_agressor).length > 0 ? ao.dados_agressor : null);
  const processoInfo = dadosInput.processo || ao.dados_processo || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filtroModo} onValueChange={setFiltroModo}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="Filtrar modo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos_filtro">Todos os modos</SelectItem>
            <SelectItem value="todos">Análise Completa</SelectItem>
            <SelectItem value="analitico">Analítico</SelectItem>
            <SelectItem value="despacho">Despacho</SelectItem>
            <SelectItem value="parecer">Parecer Técnico</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchConsultas} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{consultas.length} consultas</span>
      </div>

      {consultas.length === 0 && !loading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma consulta encontrada</CardContent></Card>
      )}

      <div className="space-y-2">
        {consultas.map((c) => {
          const Icon = MODO_ICONS[c.modo_saida] || FileText;
          return (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => fetchDetail(c.id)}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={c.status === "success" ? "default" : "destructive"} className="text-xs">
                      {MODO_LABELS[c.modo_saida] || c.modo_saida}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    ID: {c.id.substring(0, 8)}... | Modelo: {c.model || "—"} | Prompt: {c.prompt_version || "—"}
                  </p>
                </div>
                <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <DialogTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  Relatório de Consulta Tribunal
                </DialogTitle>
                {selected && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Hash className="w-3 h-3" /> {selected.id?.substring(0, 8)}
                    </Badge>
                    <Badge variant={selected.status === "success" ? "default" : "destructive"} className="text-[10px]">
                      {MODO_LABELS[selected.modo_saida] || selected.modo_saida}
                    </Badge>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(selected.created_at).toLocaleString("pt-BR")}
                    </span>
                    {selected.model && (
                      <span className="text-muted-foreground">Modelo: {selected.model}</span>
                    )}
                  </div>
                )}
              </div>
              {selected && selected.status === "success" && (
                <Button
                  size="sm"
                  onClick={() => {
                    const payload = buildPdfPayload(selected);
                    if (payload) generateTribunalPdf(payload);
                  }}
                  className="gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar PDF
                </Button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="p-6 space-y-5">
              {loadingDetail && (
                <div className="py-12 text-center text-sm text-muted-foreground">Carregando relatório...</div>
              )}

              {!loadingDetail && selected && (
                <>
                  {/* Identificação */}
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Partes Identificadas
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <User className="w-4 h-4 text-primary" />
                          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Vítima</span>
                        </div>
                        {vitimaInfo ? (
                          <div className="space-y-0.5 text-sm">
                            <p className="font-medium text-foreground">
                              {vitimaInfo.nome || vitimaInfo.nome_completo || (vitimaInfo.cidade_uf || vitimaInfo.cidade ? "Vítima identificada" : "—")}
                            </p>
                            {(vitimaInfo.cidade_uf || vitimaInfo.cidade) && (
                              <p className="text-xs text-muted-foreground">
                                {vitimaInfo.cidade_uf || `${vitimaInfo.cidade}${vitimaInfo.uf ? `/${vitimaInfo.uf}` : ""}`}
                              </p>
                            )}
                            {vitimaInfo.profissao && <p className="text-xs text-muted-foreground">Profissão: {vitimaInfo.profissao}</p>}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Não identificada</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <UserX className="w-4 h-4 text-destructive" />
                          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Agressor</span>
                        </div>
                        {agressorInfo ? (
                          <div className="space-y-0.5 text-sm">
                            <p className="font-medium text-foreground">
                              {agressorInfo.nome || (agressorInfo.cidade_uf || agressorInfo.profissao ? "Agressor identificado" : "—")}
                            </p>
                            {agressorInfo.cidade_uf && <p className="text-xs text-muted-foreground">{agressorInfo.cidade_uf}</p>}
                            {agressorInfo.profissao && <p className="text-xs text-muted-foreground">Profissão: {agressorInfo.profissao}</p>}
                            {agressorInfo.risk_level && (
                              <Badge variant="outline" className="text-[10px] mt-1">
                                Risco: {agressorInfo.risk_level}{agressorInfo.risk_score != null ? ` · ${agressorInfo.risk_score}` : ""}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Não identificado</p>
                        )}
                      </div>
                    </div>

                    {processoInfo && (processoInfo.numero || processoInfo.resumo) && (
                      <div className="mt-3 rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Processo</span>
                        </div>
                        {processoInfo.numero && <p className="text-sm font-mono text-foreground">{processoInfo.numero}</p>}
                        {processoInfo.resumo && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{processoInfo.resumo}</p>}
                      </div>
                    )}
                  </section>

                  <Separator />

                  {/* Erro global */}
                  {selected.error_message && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div className="text-sm text-destructive">{selected.error_message}</div>
                    </div>
                  )}

                  {/* Resultados em abas */}
                  {selected.status === "success" && (
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Resultado da Análise
                      </h3>
                      <Tabs defaultValue={isCompleta || analiticoData ? "analitico" : (despachoTexto ? "despacho" : "parecer")} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-3">
                          <TabsTrigger value="analitico" disabled={!analiticoData} className="text-xs gap-1">
                            <FileJson className="w-3.5 h-3.5" /> Analítico
                          </TabsTrigger>
                          <TabsTrigger value="despacho" disabled={!despachoTexto} className="text-xs gap-1">
                            <FileText className="w-3.5 h-3.5" /> Despacho
                          </TabsTrigger>
                          <TabsTrigger value="parecer" disabled={!parecerTexto} className="text-xs gap-1">
                            <BookOpen className="w-3.5 h-3.5" /> Parecer
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="analitico">
                          {analiticoData ? (
                            <>
                              <div className="flex justify-end mb-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyText(JSON.stringify(analiticoData, null, 2), "JSON analítico")}
                                  className="gap-1.5 text-xs"
                                >
                                  <Copy className="w-3 h-3" /> Copiar JSON
                                </Button>
                              </div>
                              <TribunalAnaliticoView data={analiticoData} />
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground italic py-4 text-center">Sem análise analítica</p>
                          )}
                        </TabsContent>

                        <TabsContent value="despacho">
                          {despachoTexto ? (
                            <>
                              <div className="flex justify-end mb-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyText(despachoTexto, "Despacho")}
                                  className="gap-1.5 text-xs"
                                >
                                  <Copy className="w-3 h-3" /> Copiar texto
                                </Button>
                              </div>
                              <Textarea
                                readOnly
                                value={despachoTexto}
                                className="text-sm min-h-[400px] font-serif leading-relaxed bg-card"
                                onFocus={(e) => e.currentTarget.select()}
                              />
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground italic py-4 text-center">Sem despacho</p>
                          )}
                        </TabsContent>

                        <TabsContent value="parecer">
                          {parecerTexto ? (
                            <>
                              <div className="flex justify-end mb-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyText(parecerTexto, "Parecer")}
                                  className="gap-1.5 text-xs"
                                >
                                  <Copy className="w-3 h-3" /> Copiar texto
                                </Button>
                              </div>
                              <Textarea
                                readOnly
                                value={parecerTexto}
                                className="text-sm min-h-[400px] font-serif leading-relaxed bg-card"
                                onFocus={(e) => e.currentTarget.select()}
                              />
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground italic py-4 text-center">Sem parecer</p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </section>
                  )}

                  {/* Objeto técnico colapsado */}
                  <details className="group rounded-lg border border-border bg-muted/20">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground p-3 hover:text-foreground transition-colors">
                      Ver objeto de análise técnico (debug)
                    </summary>
                    <pre className="text-[10px] bg-background border-t border-border p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                      {JSON.stringify(selected.analysis_object, null, 2)}
                    </pre>
                  </details>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
