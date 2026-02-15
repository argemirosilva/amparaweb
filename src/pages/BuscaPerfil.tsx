import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { callWebApi } from "@/services/webApiService";
import AppLayout from "@/components/layout/AppLayout";
import { BuscaPerfilForm } from "@/components/busca-perfil/BuscaPerfilForm";
import { BuscaPerfilResults } from "@/components/busca-perfil/BuscaPerfilResults";
import { Loader2, Search, ArrowLeft } from "lucide-react";

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
}

export interface SearchFormData {
  nome: string;
  apelido: string;
  idade_aprox: string;
  nome_pai: string;
  nome_mae: string;
  ddd: string;
  final_telefone: string;
  cidade_uf: string;
  bairro: string;
  profissao: string;
  placa_parcial: string;
}

export const emptySearchForm: SearchFormData = {
  nome: "", apelido: "", idade_aprox: "",
  nome_pai: "", nome_mae: "",
  ddd: "", final_telefone: "",
  cidade_uf: "", bairro: "",
  profissao: "", placa_parcial: "",
};

export default function BuscaPerfilPage() {
  const { sessionToken } = useAuth();
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<SearchFormData>(emptySearchForm);

  const handleSearch = async (data: SearchFormData) => {
    setError("");
    const hasAny = Object.values(data).some(v => v && String(v).trim());
    if (!hasAny) {
      setError("Preencha pelo menos um campo para buscar");
      return;
    }

    setSearching(true);
    setFormData(data);

    const payload: Record<string, any> = {};
    if (data.nome.trim()) payload.nome = data.nome.trim();
    if (data.apelido.trim()) payload.apelido = data.apelido.trim();
    if (data.idade_aprox.trim()) payload.idade_aprox = parseInt(data.idade_aprox);
    if (data.nome_pai.trim()) payload.nome_pai = data.nome_pai.trim();
    if (data.nome_mae.trim()) payload.nome_mae = data.nome_mae.trim();
    if (data.ddd.trim()) payload.ddd = data.ddd.trim();
    if (data.final_telefone.trim()) payload.final_telefone = data.final_telefone.trim();
    if (data.cidade_uf.trim()) payload.cidade_uf = data.cidade_uf.trim();
    if (data.bairro.trim()) payload.bairro = data.bairro.trim();
    if (data.profissao.trim()) payload.profissao = data.profissao.trim();
    if (data.placa_parcial.trim()) payload.placa_parcial = data.placa_parcial.trim();

    const { ok, data: resp } = await callWebApi("searchAgressorAdvanced", sessionToken!, payload);
    setSearching(false);

    if (ok && resp.results) {
      setResults(resp.results);
    } else {
      setError(resp.error || "Erro na busca");
    }
  };

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="ampara-icon-circle">
          <Search className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Buscar Perfil</h1>
          <p className="text-xs text-muted-foreground">Pesquise por dados parciais — nunca expomos dados sensíveis</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {results === null ? (
        <>
          <BuscaPerfilForm onSubmit={handleSearch} loading={searching} />
          {searching && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Analisando correspondências com IA...</span>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setResults(null)}
            className="ampara-btn-secondary !py-2 !px-4 text-sm flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Nova busca
          </button>
          <BuscaPerfilResults results={results} />
        </div>
      )}
    </div>
  );
}
