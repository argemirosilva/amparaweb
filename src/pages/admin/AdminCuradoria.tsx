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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { BrainCircuit } from "lucide-react";
import { toast } from "sonner";
import CuradoriaDetailDrawer from "@/components/curadoria/CuradoriaDetailDrawer";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminFilterBar from "@/components/admin/AdminFilterBar";
import AdminTableWrapper from "@/components/admin/AdminTableWrapper";

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
  avaliacoes_count?: number;
}

const RISK_COLORS: Record<string, string> = {
  critico: "bg-red-600 text-white",
  alto: "bg-orange-500 text-white",
  moderado: "bg-yellow-500 text-black",
  baixo: "bg-green-500 text-white",
  nenhum: "bg-gray-400 text-white",
};

const CONTEXT_LABELS: Record<string, string> = {
  saudavel: "Saudável",
  rispido_nao_abusivo: "Ríspido",
  potencial_abuso_leve: "Abuso leve",
  padrao_consistente_abuso: "Padrão abuso",
  ameaca_risco: "Ameaça/risco",
  risco_elevado_escalada: "Risco escalada",
};

const PAGE_SIZES = [25, 50, 100];
const TOTAL_CAMPOS = 8;

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

  const handleToggleCupiado = useCallback((item: CuradoriaItem) => {
    toggleMutation.mutate(
      { analise_id: item.analise_id, cupiado: !item.cupiado },
      { onSuccess: () => setSelected({ ...item, cupiado: !item.cupiado }) }
    );
  }, [toggleMutation]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const fmtDuration = (s: number | null) => {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}m${sec.toString().padStart(2, "0")}s`;
  };

  return (
    <div>
      <AdminPageHeader
        icon={BrainCircuit}
        breadcrumb="Admin › Curadoria IA"
        title="Curadoria IA"
        description="Avalie e valide análises de inteligência artificial"
      />

      <AdminFilterBar>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Nível de Risco</label>
          <Select value={nivelRisco} onValueChange={(v) => { setNivelRisco(v); setPage(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="moderado">Moderado</SelectItem>
              <SelectItem value="baixo">Baixo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">De</label>
          <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPage(0); }} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Até</label>
          <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPage(0); }} className="w-40" />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <Checkbox
            checked={somenteCuradas}
            onCheckedChange={(v) => { setSomenteCuradas(!!v); setPage(0); }}
          />
          <label className="text-sm text-muted-foreground">Somente curadas</label>
        </div>
      </AdminFilterBar>

      <AdminTableWrapper>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Data/hora</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Risco</TableHead>
              <TableHead>Contexto</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead className="text-center">Curada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma transcrição encontrada</TableCell></TableRow>
            ) : items.map((item) => {
              const avCount = item.avaliacoes_count || 0;
              const progressPct = Math.round((avCount / TOTAL_CAMPOS) * 100);
              return (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelected(item)}
                >
                  <TableCell className="whitespace-nowrap text-sm">{fmtDate(item.created_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDuration(item.duracao_segundos)}</TableCell>
                  <TableCell>
                    {item.nivel_risco ? (
                      <Badge className={`${RISK_COLORS[item.nivel_risco] || "bg-muted text-foreground"} text-xs capitalize`}>
                        {item.nivel_risco}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.context_classification
                      ? CONTEXT_LABELS[item.context_classification] || item.context_classification
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <Progress value={progressPct} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{avCount}/{TOTAL_CAMPOS}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={item.cupiado}
                      onCheckedChange={(v) => toggleMutation.mutate({ analise_id: item.analise_id, cupiado: !!v })}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </AdminTableWrapper>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Por página:</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm ml-2 text-muted-foreground">
            {total} registro{total !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-sm self-center text-muted-foreground">
            {page + 1} / {totalPages || 1}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      </div>

      <CuradoriaDetailDrawer
        selected={selected}
        onClose={() => setSelected(null)}
        onToggleCupiado={handleToggleCupiado}
        onAutoCurada={() => {
          setSelected(null);
          queryClient.invalidateQueries({ queryKey: ["curadoria"] });
        }}
      />
    </div>
  );
}
