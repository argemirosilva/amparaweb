import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Loader2, ChevronRight, ChevronLeft, Plus, Trash2, Search, Shield, AlertTriangle } from "lucide-react";
import { callWebApi } from "@/services/webApiService";
import { useNavigate } from "react-router-dom";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const TIPOS_VINCULO = [
  "Marido", "Ex-marido", "Namorado", "Ex-namorado",
  "Noivo", "Ex-noivo", "Companheiro", "Ex-companheiro", "Outro",
];

interface Guardiao {
  nome: string;
  vinculo: string;
  telefone_whatsapp: string;
}

interface AgressorForm {
  nome: string;
  tipo_vinculo: string;
  data_nascimento: string;
  telefone: string;
  nome_pai_parcial: string;
  nome_mae_parcial: string;
  forca_seguranca: boolean;
  tem_arma_em_casa: boolean;
}

interface SearchResult {
  id: string;
  nome_parcial: string;
  ano_nascimento: number | null;
  forca_seguranca: boolean;
  tem_arma_em_casa: boolean;
  total_vinculos: number;
}

export default function OnboardingPage() {
  const { sessionToken } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 - Victim data
  const [vitima, setVitima] = useState({
    data_nascimento: "",
    endereco_fixo: "",
    tem_filhos: false,
    mora_com_agressor: false,
  });

  // Step 2 - Guardians
  const [guardioes, setGuardioes] = useState<Guardiao[]>([{ nome: "", vinculo: "", telefone_whatsapp: "" }]);

  // Step 3 - Aggressor
  const [agressorMode, setAgressorMode] = useState<"new" | "search" | null>(null);
  const [agressor, setAgressor] = useState<AgressorForm>({
    nome: "", tipo_vinculo: "", data_nascimento: "", telefone: "",
    nome_pai_parcial: "", nome_mae_parcial: "",
    forca_seguranca: false, tem_arma_em_casa: false,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [linkTipoVinculo, setLinkTipoVinculo] = useState("");

  const api = (action: string, params: Record<string, any> = {}) =>
    callWebApi(action, sessionToken!, params);

  // Step 1 submit
  const handleStep1 = async () => {
    setError("");
    if (!vitima.data_nascimento) { setError("Data de nascimento é obrigatória"); return; }
    setLoading(true);
    const { ok, data } = await api("updateMe", vitima);
    if (!ok) { setError(data.error || "Erro ao salvar"); setLoading(false); return; }
    setLoading(false);
    setStep(2);
  };

  // Step 2 submit
  const handleStep2 = async () => {
    setError("");
    const valid = guardioes.filter(g => g.nome.trim() && g.vinculo.trim() && g.telefone_whatsapp.replace(/\D/g, "").length >= 10);
    if (valid.length === 0) { setError("Adicione pelo menos 1 guardião com dados completos"); return; }
    setLoading(true);
    for (const g of valid) {
      const { ok, data } = await api("createGuardiao", g);
      if (!ok) { setError(data.error || "Erro ao salvar guardião"); setLoading(false); return; }
    }
    setLoading(false);
    setStep(3);
  };

  // Step 3 - search
  const handleSearch = async () => {
    if (searchQuery.trim().length < 3) { setError("Digite pelo menos 3 caracteres"); return; }
    setError("");
    setSearching(true);
    const { ok, data } = await api("searchAgressor", { query: searchQuery });
    setSearching(false);
    if (ok) setSearchResults(data.resultados || []);
    else setError(data.error || "Erro na busca");
  };

  // Step 3 - link existing
  const handleLinkExisting = async () => {
    if (!selectedMatch || !linkTipoVinculo) { setError("Selecione o agressor e o tipo de vínculo"); return; }
    setLoading(true);
    const { ok, data } = await api("linkAgressor", { agressor_id: selectedMatch, tipo_vinculo: linkTipoVinculo });
    if (!ok) { setError(data.error || "Erro ao vincular"); setLoading(false); return; }
    await finishOnboarding();
  };

  // Step 3 - create new
  const handleCreateNew = async () => {
    setError("");
    if (!agressor.nome.trim()) { setError("Nome do agressor é obrigatório"); return; }
    if (!agressor.tipo_vinculo) { setError("Tipo de vínculo é obrigatório"); return; }
    setLoading(true);
    const { ok, data } = await api("createAgressor", agressor);
    if (!ok) { setError(data.error || "Erro ao cadastrar agressor"); setLoading(false); return; }
    await finishOnboarding();
  };

  const finishOnboarding = async () => {
    await api("updateMe", { onboarding_completo: true });
    setLoading(false);
    navigate("/home");
  };

  const skipStep3 = async () => {
    setLoading(true);
    await api("updateMe", { onboarding_completo: true });
    setLoading(false);
    navigate("/home");
  };

  const addGuardiao = () => setGuardioes([...guardioes, { nome: "", vinculo: "", telefone_whatsapp: "" }]);
  const removeGuardiao = (i: number) => setGuardioes(guardioes.filter((_, idx) => idx !== i));
  const updateGuardiao = (i: number, field: keyof Guardiao, value: string) => {
    const updated = [...guardioes];
    updated[i] = { ...updated[i], [field]: field === "telefone_whatsapp" ? formatPhone(value) : value };
    setGuardioes(updated);
  };

  return (
    <AuthLayout title={`Passo ${step} de 3`} subtitle={
      step === 1 ? "Seus dados pessoais" :
      step === 2 ? "Sua rede de apoio" :
      "Informações do agressor"
    }>
      {/* Progress bar */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "ampara-gradient-bg" : "bg-muted"}`} />
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      {/* ===== STEP 1: Victim data ===== */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Data de nascimento</label>
            <input type="date" className="ampara-input" value={vitima.data_nascimento}
              onChange={e => setVitima({ ...vitima, data_nascimento: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Endereço fixo</label>
            <input type="text" className="ampara-input" placeholder="Rua, número, bairro, cidade"
              value={vitima.endereco_fixo} maxLength={300}
              onChange={e => setVitima({ ...vitima, endereco_fixo: e.target.value })} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={vitima.tem_filhos}
              onChange={e => setVitima({ ...vitima, tem_filhos: e.target.checked })}
              className="h-4 w-4 rounded border-input accent-primary" />
            <span className="text-sm text-foreground">Tem filhos?</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={vitima.mora_com_agressor}
              onChange={e => setVitima({ ...vitima, mora_com_agressor: e.target.checked })}
              className="h-4 w-4 rounded border-input accent-primary" />
            <span className="text-sm text-foreground">Mora na mesma casa que o agressor?</span>
          </label>
          <button onClick={handleStep1} disabled={loading} className="ampara-btn-primary mt-2 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Próximo <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      )}

      {/* ===== STEP 2: Guardians ===== */}
      {step === 2 && (
        <div className="space-y-4">
          {guardioes.map((g, i) => (
            <div key={i} className="ampara-card !p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Guardião {i + 1}</span>
                {guardioes.length > 1 && (
                  <button onClick={() => removeGuardiao(i)} className="text-destructive hover:text-destructive/80 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input type="text" className="ampara-input" placeholder="Nome" value={g.nome} maxLength={100}
                onChange={e => updateGuardiao(i, "nome", e.target.value)} />
              <input type="text" className="ampara-input" placeholder="Vínculo (mãe, irmã, amiga...)" value={g.vinculo} maxLength={50}
                onChange={e => updateGuardiao(i, "vinculo", e.target.value)} />
              <input type="tel" className="ampara-input" placeholder="(00) 00000-0000" value={g.telefone_whatsapp}
                onChange={e => updateGuardiao(i, "telefone_whatsapp", e.target.value)} />
            </div>
          ))}

          <button onClick={addGuardiao} className="ampara-btn-secondary flex items-center justify-center gap-2 !py-2.5 text-sm">
            <Plus className="w-4 h-4" /> Adicionar guardião
          </button>

          <div className="flex gap-3 mt-2">
            <button onClick={() => setStep(1)} className="ampara-btn-secondary flex-1 flex items-center justify-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            <button onClick={handleStep2} disabled={loading} className="ampara-btn-primary flex-1 flex items-center justify-center gap-1">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Próximo <ChevronRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: Aggressor ===== */}
      {step === 3 && (
        <div className="space-y-4">
          {!agressorMode && (
            <div className="space-y-3">
              <button onClick={() => setAgressorMode("new")}
                className="ampara-card !p-4 w-full text-left hover:border-primary transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="ampara-icon-circle-sm"><Plus className="w-4 h-4" /></div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Cadastrar novo agressor</p>
                    <p className="text-xs text-muted-foreground">Preencher ficha completa</p>
                  </div>
                </div>
              </button>
              <button onClick={() => setAgressorMode("search")}
                className="ampara-card !p-4 w-full text-left hover:border-primary transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="ampara-icon-circle-sm"><Search className="w-4 h-4" /></div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Localizar agressor existente</p>
                    <p className="text-xs text-muted-foreground">Buscar por nome ou telefone</p>
                  </div>
                </div>
              </button>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(2)} className="ampara-btn-secondary flex-1 flex items-center justify-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                <button onClick={skipStep3} disabled={loading}
                  className="flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Pular por agora"}
                </button>
              </div>
            </div>
          )}

          {/* New aggressor form */}
          {agressorMode === "new" && (
            <div className="space-y-3">
              <input type="text" className="ampara-input" placeholder="Nome do agressor" value={agressor.nome} maxLength={100}
                onChange={e => setAgressor({ ...agressor, nome: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Tipo de vínculo</label>
                <select className="ampara-input" value={agressor.tipo_vinculo}
                  onChange={e => setAgressor({ ...agressor, tipo_vinculo: e.target.value })}>
                  <option value="">Selecione...</option>
                  {TIPOS_VINCULO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <input type="date" className="ampara-input" value={agressor.data_nascimento}
                onChange={e => setAgressor({ ...agressor, data_nascimento: e.target.value })} />
              <input type="tel" className="ampara-input" placeholder="Telefone do agressor" value={agressor.telefone}
                onChange={e => setAgressor({ ...agressor, telefone: formatPhone(e.target.value) })} />
              <input type="text" className="ampara-input" placeholder="Nome do pai (pode ser parcial)" value={agressor.nome_pai_parcial} maxLength={100}
                onChange={e => setAgressor({ ...agressor, nome_pai_parcial: e.target.value })} />
              <input type="text" className="ampara-input" placeholder="Nome da mãe (pode ser parcial)" value={agressor.nome_mae_parcial} maxLength={100}
                onChange={e => setAgressor({ ...agressor, nome_mae_parcial: e.target.value })} />
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={agressor.forca_seguranca}
                  onChange={e => setAgressor({ ...agressor, forca_seguranca: e.target.checked })}
                  className="h-4 w-4 rounded border-input accent-primary" />
                <span className="text-sm text-foreground">É de alguma força de segurança?</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={agressor.tem_arma_em_casa}
                  onChange={e => setAgressor({ ...agressor, tem_arma_em_casa: e.target.checked })}
                  className="h-4 w-4 rounded border-input accent-primary" />
                <span className="text-sm text-foreground">Tem arma em casa?</span>
              </label>

              <div className="flex gap-3 mt-2">
                <button onClick={() => setAgressorMode(null)} className="ampara-btn-secondary flex-1 flex items-center justify-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                <button onClick={handleCreateNew} disabled={loading} className="ampara-btn-primary flex-1 flex items-center justify-center gap-1">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Finalizar"}
                </button>
              </div>
            </div>
          )}

          {/* Search aggressor */}
          {agressorMode === "search" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" className="ampara-input flex-1" placeholder="Nome ou telefone do agressor"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()} />
                <button onClick={handleSearch} disabled={searching}
                  className="ampara-btn-primary !w-auto !px-4 flex items-center gap-1">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Encontramos possíveis registros parecidos. Não temos certeza.
                  </p>
                  {searchResults.map(r => (
                    <button key={r.id} onClick={() => setSelectedMatch(r.id)}
                      className={`ampara-card !p-3 w-full text-left transition-colors cursor-pointer ${selectedMatch === r.id ? "!border-primary ring-2 ring-ring/30" : ""}`}>
                      <p className="font-semibold text-foreground text-sm">{r.nome_parcial}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-xs">
                        {r.ano_nascimento && <span className="ampara-tag !py-0.5 !px-2">Nasc: {r.ano_nascimento}</span>}
                        <span className="ampara-tag !py-0.5 !px-2">Vínculos: {r.total_vinculos}</span>
                        {r.forca_seguranca && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                            <Shield className="w-3 h-3" /> Força de segurança
                          </span>
                        )}
                        {r.tem_arma_em_casa && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                            <AlertTriangle className="w-3 h-3" /> Arma em casa
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedMatch && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Tipo de vínculo</label>
                  <select className="ampara-input" value={linkTipoVinculo}
                    onChange={e => setLinkTipoVinculo(e.target.value)}>
                    <option value="">Selecione...</option>
                    {TIPOS_VINCULO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button onClick={() => { setAgressorMode(null); setSearchResults([]); setSelectedMatch(null); }}
                  className="ampara-btn-secondary flex-1 flex items-center justify-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
                {selectedMatch ? (
                  <button onClick={handleLinkExisting} disabled={loading}
                    className="ampara-btn-primary flex-1 flex items-center justify-center gap-1">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Vincular e finalizar"}
                  </button>
                ) : (
                  <button onClick={skipStep3} disabled={loading}
                    className="flex-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Pular por agora"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
