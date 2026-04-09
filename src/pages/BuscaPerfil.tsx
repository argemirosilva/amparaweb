import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import { BuscaPerfilForm } from "@/components/busca-perfil/BuscaPerfilForm";
import { BuscaPerfilResults } from "@/components/busca-perfil/BuscaPerfilResults";
import PageHeader from "@/components/ui/page-header";
import { Loader2, UserSearch, ArrowLeft, CircleAlert } from "lucide-react";

export interface SearchResult {
  profile_id: string;
  display_name_masked: string;
  location_summary: string;
  probability_percent: number;
  match_breakdown: {
    field: string;
    status: "completo" | "parcial" | "nao_bateu" | "conflitante";
    user_value_masked: string;
    candidate_value_masked: string;
    similarity: number;
  }[];
  strong_signals: string[];
  weak_signals: string[];
  conflicts: string[];
  risk_level: string;
  violence_probabilities: Record<string, number>;
  explanation_short: string;
  guidance: string[];
  forca_seguranca?: boolean;
  tem_arma_em_casa?: boolean;
  xingamentos_frequentes?: string[];
  flags?: string[];
}

export interface SearchFormData {
  nome: string;
  idade_aprox: string;
  nome_pai: string;
  nome_mae: string;
  cpf: string;
  ddd: string;
  final_telefone: string;
  cidade_uf: string;
  bairro: string;
  profissao: string;
  placa_parcial: string;
  forca_seguranca: string;
  tem_arma: string;
  cor_raca: string;
  escolaridade: string;
  empresa: string;
  xingamentos: string;
}

export const emptySearchForm: SearchFormData = {
  nome: "", idade_aprox: "",
  nome_pai: "", nome_mae: "",
  cpf: "",
  ddd: "", final_telefone: "",
  cidade_uf: "", bairro: "",
  profissao: "", placa_parcial: "",
  forca_seguranca: "", tem_arma: "",
  cor_raca: "", escolaridade: "",
  empresa: "", xingamentos: "",
};

export default function BuscaPerfilPage() {
  const { sessionToken } = useAuth();
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<SearchFormData>(emptySearchForm);

  const handleSearch = async (data: SearchFormData) => {
    setError("");
    const filled = Object.entries(data).filter(([, v]) => v && String(v).trim());
    if (filled.length < 2) {
      setError("Preencha pelo menos 2 campos para uma busca mais precisa");
      return;
    }

    setSearching(true);
    setFormData(data);

    const payload: Record<string, any> = {};
    if (data.nome.trim()) payload.nome = data.nome.trim();
    if (data.idade_aprox.trim()) payload.idade_aprox = parseInt(data.idade_aprox);
    if (data.nome_pai.trim()) payload.nome_pai = data.nome_pai.trim();
    if (data.nome_mae.trim()) payload.nome_mae = data.nome_mae.trim();
    if (data.cpf.trim()) payload.cpf = data.cpf.replace(/\D/g, "");
    if (data.ddd.trim()) payload.ddd = data.ddd.trim();
    if (data.final_telefone.trim()) payload.final_telefone = data.final_telefone.trim();
    if (data.cidade_uf.trim()) payload.cidade_uf = data.cidade_uf.trim();
    if (data.bairro.trim()) payload.bairro = data.bairro.trim();
    if (data.profissao.trim()) payload.profissao = data.profissao.trim();
    if (data.placa_parcial.trim()) payload.placa_parcial = data.placa_parcial.trim();
    if (data.forca_seguranca) payload.forca_seguranca = data.forca_seguranca;
    if (data.tem_arma) payload.tem_arma = data.tem_arma;
    if (data.cor_raca.trim()) payload.cor_raca = data.cor_raca.trim();
    if (data.escolaridade.trim()) payload.escolaridade = data.escolaridade.trim();
    if (data.empresa.trim()) payload.empresa = data.empresa.trim();
    if (data.xingamentos.trim()) payload.xingamentos = data.xingamentos.trim();

    const { ok, data: resp } = await callWebApi("searchAgressorAdvanced", sessionToken!, payload);
    setSearching(false);

    if (ok && resp.results) {
      setResults(resp.results);
    } else {
      setError(resp.error || "Erro na busca");
    }
  };

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-5">
      <PageHeader tag="Pesquisa" title="Pesquisar parceiro" subtitle="Pesquise por dados parciais - nunca expomos dados sensíveis" />

      {/* Info box */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
        <div className="flex items-start gap-3">
          <CircleAlert className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1.5">
            <p className="text-sm text-foreground leading-relaxed">
              Cruza dados parciais com relatos anônimos de outras mulheres para indicar possíveis riscos. Quanto mais campos preencher, melhor o resultado.
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed font-medium">
              ⚠ Resultados indicativos - baseados em relatos voluntários, não auditados. Não substituem denúncias formais.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
          <span className="shrink-0">❌</span> {error}
        </div>
      )}

      {results === null ? (
        <>
          <BuscaPerfilForm onSubmit={handleSearch} loading={searching} />
          {searching && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-primary/20" />
                <Loader2 className="w-14 h-14 animate-spin text-primary absolute inset-0" />
              </div>
              <span className="mt-4 text-sm text-muted-foreground font-medium">Analisando correspondências com IA...</span>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setResults(null)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Nova busca
          </button>
          <BuscaPerfilResults results={results} searchInput={formData} />
        </div>
      )}
    </div>
  );
}
