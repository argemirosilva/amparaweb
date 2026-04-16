import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Search, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { callCampoApi, type VitimaResultado } from "@/services/campoService";
import { toast } from "sonner";

export default function CampoBusca() {
  const navigate = useNavigate();
  const [agente, setAgente] = useState(() => localStorage.getItem("campo_agente") ?? "");
  const [orgao, setOrgao] = useState(() => localStorage.getItem("campo_orgao") ?? "");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<VitimaResultado[] | null>(null);

  const handleBuscar = async () => {
    if (!agente.trim()) return toast.error("Informe sua identificação (matrícula).");
    if (query.trim().length < 3) return toast.error("Termo de busca muito curto.");

    localStorage.setItem("campo_agente", agente.trim());
    localStorage.setItem("campo_orgao", orgao.trim());

    setLoading(true);
    setResultados(null);
    const { ok, data } = await callCampoApi("buscarVitima", {
      query: query.trim(),
      agente_identificacao: agente.trim(),
      agente_orgao: orgao.trim(),
    });
    setLoading(false);

    if (!ok) return toast.error(data?.error ?? "Falha na consulta.");
    setResultados(data.resultados ?? []);
    if ((data.resultados ?? []).length === 0) {
      toast.info("Nenhum registro encontrado para esse termo.");
    }
  };

  const handleSelecionar = (id: string) => {
    navigate(`/campo/vitima/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Shield className="w-7 h-7 text-amber-400" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">AMPARA Campo</h1>
            <p className="text-xs text-slate-300">Apoio operacional às forças de segurança</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Card className="p-5 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Esta consulta é <strong>auditada</strong>. Use apenas em atendimento de ocorrência.
              Os dados retornados são <strong>indicativos</strong> e <strong>não substituem</strong> o relato presencial.
            </p>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="agente">Sua identificação (matrícula) *</Label>
              <Input id="agente" value={agente} onChange={(e) => setAgente(e.target.value)} placeholder="Ex: PM-123456" />
            </div>
            <div>
              <Label htmlFor="orgao">Órgão</Label>
              <Input id="orgao" value={orgao} onChange={(e) => setOrgao(e.target.value)} placeholder="Ex: PMSP, GCM, PCSP" />
            </div>
          </div>

          <div>
            <Label htmlFor="query">Buscar vítima por nome, CPF ou telefone</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
                placeholder="Ex: Maria Silva, 000.000.000-00 ou (11) 99999-9999"
                autoComplete="off"
              />
              <Button onClick={handleBuscar} disabled={loading} className="shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-2 hidden sm:inline">Buscar</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Aceita nome completo ou parcial, CPF (com ou sem pontuação) ou telefone.
            </p>
          </div>
        </Card>

        {resultados && resultados.length > 0 && (
          <Card className="p-2 divide-y">
            {resultados.map((v) => (
              <button
                key={v.id}
                onClick={() => handleSelecionar(v.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/60 transition-colors text-left"
              >
                <div>
                  <p className="font-medium">{v.nome_mascarado}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.telefone_mascarado} · cadastrada desde {new Date(v.cadastrada_desde).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </Card>
        )}

        {resultados && resultados.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado. Verifique o termo digitado.
          </Card>
        )}
      </main>
    </div>
  );
}
