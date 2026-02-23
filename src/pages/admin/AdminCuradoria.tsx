import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, ChevronDown, ChevronUp, BrainCircuit } from "lucide-react";
import { toast } from "sonner";

interface CuradoriaItem {
  id: string;
  analise_id: string;
  created_at: string;
  duracao_segundos: number | null;
  transcricao_anonimizada: string;
  nivel_risco: string | null;
  sentimento: string | null;
  categorias: string[] | null;
  palavras_chave: string[] | null;
  xingamentos: string[] | null;
  resumo_anonimizado: string;
  cupiado: boolean;
  context_classification: string | null;
  cycle_phase: string | null;
  output_json_anonimizado: any;
}

const RISK_COLORS: Record<string, string> = {
  critico: "bg-red-600 text-white",
  alto: "bg-orange-500 text-white",
  moderado: "bg-yellow-500 text-black",
  baixo: "bg-green-500 text-white",
  nenhum: "bg-gray-400 text-white",
};

const PAGE_SIZES = [25, 50, 100];

async function callAdmin(sessionToken: string, action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke("admin-api", {
    body: { action, session_token: sessionToken, ...params },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminCuradoria() {
  const { sessionToken } = useAuth();
  const queryClient = useQueryClient();

  const [nivelRisco, setNivelRisco] = useState<string>("all");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [somenteCuradas, setSomenteCuradas] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CuradoriaItem | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);

  const queryKey = ["curadoria", nivelRisco, dataInicio, dataFim, somenteCuradas, page, pageSize];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      callAdmin(sessionToken!, "listCuradoria", {
        nivel_risco: nivelRisco === "all" ? undefined : nivelRisco,
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        somente_curadas: somenteCuradas || undefined,
        offset: page * pageSize,
        limit: pageSize,
      }),
    enabled: !!sessionToken,
  });

  const items: CuradoriaItem[] = data?.items || [];
  const total: number = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const toggleMutation = useMutation({
    mutationFn: ({ analise_id, cupiado }: { analise_id: string; cupiado: boolean }) =>
      callAdmin(sessionToken!, "toggleCuradoria", { analise_id, cupiado }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["curadoria"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = useCallback(async () => {
    try {
      const { data: raw, error } = await supabase.functions.invoke("admin-api", {
        body: {
          action: "exportCuradoria",
          session_token: sessionToken,
          somente_curadas: somenteCuradas || undefined,
        },
      });
      if (error) throw error;
      // raw might be text or object depending on response
      const text = typeof raw === "string" ? raw : JSON.stringify(raw);
      const blob = new Blob([text], { type: "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "curadoria_export.jsonl";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
    } catch (e: any) {
      toast.error("Erro ao exportar: " + e.message);
    }
  }, [sessionToken, somenteCuradas]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const fmtDuration = (s: number | null) => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m${sec.toString().padStart(2, "0")}s`;
  };

  const fontStyle = { fontFamily: "Inter, Roboto, sans-serif" };

  return (
    <div style={fontStyle}>
      <div className="flex items-center gap-3 mb-6">
        <BrainCircuit className="w-6 h-6" style={{ color: "hsl(224 76% 33%)" }} />
        <h1 className="text-2xl font-bold" style={{ color: "hsl(220 13% 18%)" }}>Curadoria IA</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end p-4 rounded-lg" style={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 13% 91%)" }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Nível de Risco</label>
          <Select value={nivelRisco} onValueChange={(v) => { setNivelRisco(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="moderado">Moderado</SelectItem>
              <SelectItem value="baixo">Baixo</SelectItem>
              <SelectItem value="nenhum">Nenhum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>De</label>
          <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPage(0); }} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "hsl(220 9% 46%)" }}>Até</label>
          <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPage(0); }} className="w-40" />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <Checkbox
            checked={somenteCuradas}
            onCheckedChange={(v) => { setSomenteCuradas(!!v); setPage(0); }}
          />
          <label className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Somente curadas</label>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto">
          <Download className="w-4 h-4 mr-1" /> Exportar .jsonl
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 13% 91%)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/hora</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Risco</TableHead>
              <TableHead>Sentimento</TableHead>
              <TableHead>Transcrição (preview)</TableHead>
              <TableHead className="text-center">Curada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8" style={{ color: "hsl(220 9% 46%)" }}>Carregando...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8" style={{ color: "hsl(220 9% 46%)" }}>Nenhuma transcrição encontrada</TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => setSelected(item)}
              >
                <TableCell className="whitespace-nowrap text-sm">{fmtDate(item.created_at)}</TableCell>
                <TableCell className="text-sm">{fmtDuration(item.duracao_segundos)}</TableCell>
                <TableCell>
                  {item.nivel_risco && (
                    <Badge className={RISK_COLORS[item.nivel_risco] || "bg-gray-300"}>
                      {item.nivel_risco}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm capitalize">{item.sentimento || "—"}</TableCell>
                <TableCell className="text-sm max-w-xs truncate" style={{ color: "hsl(220 13% 18%)" }}>
                  {item.transcricao_anonimizada.slice(0, 80)}{item.transcricao_anonimizada.length > 80 ? "…" : ""}
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={item.cupiado}
                    onCheckedChange={(v) => toggleMutation.mutate({ analise_id: item.analise_id, cupiado: !!v })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>Por página:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm ml-2" style={{ color: "hsl(220 9% 46%)" }}>
            {total} registro{total !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-sm self-center" style={{ color: "hsl(220 9% 46%)" }}>
            {page + 1} / {totalPages || 1}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" style={fontStyle}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5" style={{ color: "hsl(224 76% 33%)" }} />
              Detalhes da Transcrição
            </SheetTitle>
          </SheetHeader>

          {selected && (
            <div className="mt-4 space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>{fmtDate(selected.created_at)}</span>
                <span className="text-sm" style={{ color: "hsl(220 9% 46%)" }}>{fmtDuration(selected.duracao_segundos)}</span>
                {selected.nivel_risco && (
                  <Badge className={RISK_COLORS[selected.nivel_risco] || "bg-gray-300"}>{selected.nivel_risco}</Badge>
                )}
                <span className="text-sm capitalize" style={{ color: "hsl(220 9% 46%)" }}>{selected.sentimento}</span>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: "hsl(220 13% 18%)" }}>Transcrição Anonimizada</h3>
                <p className="text-sm whitespace-pre-wrap p-3 rounded" style={{ background: "hsl(210 17% 96%)", color: "hsl(220 13% 18%)" }}>
                  {selected.transcricao_anonimizada}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: "hsl(220 13% 18%)" }}>Resumo Anonimizado</h3>
                <p className="text-sm whitespace-pre-wrap p-3 rounded" style={{ background: "hsl(210 17% 96%)", color: "hsl(220 13% 18%)" }}>
                  {selected.resumo_anonimizado || "—"}
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                {selected.categorias?.length ? (
                  <div>
                    <h4 className="text-xs font-semibold mb-1" style={{ color: "hsl(220 9% 46%)" }}>Categorias</h4>
                    <div className="flex flex-wrap gap-1">
                      {selected.categorias.map((c, i) => <Badge key={i} variant="secondary">{c}</Badge>)}
                    </div>
                  </div>
                ) : null}
                {selected.palavras_chave?.length ? (
                  <div>
                    <h4 className="text-xs font-semibold mb-1" style={{ color: "hsl(220 9% 46%)" }}>Palavras-chave</h4>
                    <div className="flex flex-wrap gap-1">
                      {selected.palavras_chave.map((p, i) => <Badge key={i} variant="outline">{p}</Badge>)}
                    </div>
                  </div>
                ) : null}
                {selected.xingamentos?.length ? (
                  <div>
                    <h4 className="text-xs font-semibold mb-1" style={{ color: "hsl(0 73% 42%)" }}>Xingamentos</h4>
                    <div className="flex flex-wrap gap-1">
                      {selected.xingamentos.map((x, i) => <Badge key={i} variant="destructive">{x}</Badge>)}
                    </div>
                  </div>
                ) : null}
              </div>

              {(selected.context_classification || selected.cycle_phase) && (
                <div className="flex gap-4">
                  {selected.context_classification && (
                    <div>
                      <h4 className="text-xs font-semibold mb-1" style={{ color: "hsl(220 9% 46%)" }}>Classificação de Contexto</h4>
                      <Badge variant="secondary">{selected.context_classification}</Badge>
                    </div>
                  )}
                  {selected.cycle_phase && (
                    <div>
                      <h4 className="text-xs font-semibold mb-1" style={{ color: "hsl(220 9% 46%)" }}>Fase do Ciclo</h4>
                      <Badge variant="secondary">{selected.cycle_phase}</Badge>
                    </div>
                  )}
                </div>
              )}

              {selected.output_json_anonimizado && (
                <Collapsible open={jsonOpen} onOpenChange={setJsonOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold" style={{ color: "hsl(224 76% 33%)" }}>
                    Output JSON (Micro Result)
                    {jsonOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <pre className="text-xs mt-2 p-3 rounded overflow-auto max-h-80" style={{ background: "hsl(210 17% 96%)", color: "hsl(220 13% 18%)" }}>
                      {JSON.stringify(selected.output_json_anonimizado, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <div className="pt-2">
                <Button
                  variant={selected.cupiado ? "outline" : "default"}
                  onClick={() => {
                    toggleMutation.mutate(
                      { analise_id: selected.analise_id, cupiado: !selected.cupiado },
                      { onSuccess: () => setSelected({ ...selected, cupiado: !selected.cupiado }) }
                    );
                  }}
                >
                  {selected.cupiado ? "Desmarcar curada" : "Marcar como curada"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
