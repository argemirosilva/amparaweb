import { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { type SearchFormData, emptySearchForm } from "@/pages/BuscaPerfil";

interface Props {
  onSubmit: (data: SearchFormData) => void;
  loading: boolean;
}

export function BuscaPerfilForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<SearchFormData>(emptySearchForm);
  const [showMore, setShowMore] = useState(false);

  const set = (field: keyof SearchFormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const filledCount = Object.values(form).filter(v => v.trim()).length;

  return (
    <div className="space-y-4">
      {/* Primary fields */}
      <div className="ampara-card !p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Identificação</p>
        <input
          type="text" className="ampara-input" placeholder="Nome (parcial ou completo)"
          value={form.nome} onChange={e => set("nome", e.target.value)} maxLength={100}
        />
        <input
          type="text" className="ampara-input" placeholder="Apelido"
          value={form.apelido} onChange={e => set("apelido", e.target.value)} maxLength={50}
        />
        <input
          type="number" className="ampara-input" placeholder="Idade aproximada"
          value={form.idade_aprox} onChange={e => set("idade_aprox", e.target.value)}
          min={15} max={100}
        />
      </div>

      <div className="ampara-card !p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Família (só 1º nome basta)</p>
        <input
          type="text" className="ampara-input" placeholder="Primeiro nome do pai"
          value={form.nome_pai} onChange={e => set("nome_pai", e.target.value)} maxLength={50}
        />
        <input
          type="text" className="ampara-input" placeholder="Primeiro nome da mãe"
          value={form.nome_mae} onChange={e => set("nome_mae", e.target.value)} maxLength={50}
        />
      </div>

      <div className="ampara-card !p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Localização aproximada</p>
        <div className="flex gap-2">
          <input
            type="text" className="ampara-input flex-1" placeholder="Cidade/UF (ex: São Paulo/SP)"
            value={form.cidade_uf} onChange={e => set("cidade_uf", e.target.value)} maxLength={60}
          />
        </div>
        <input
          type="text" className="ampara-input" placeholder="Bairro ou região"
          value={form.bairro} onChange={e => set("bairro", e.target.value)} maxLength={60}
        />
      </div>

      {/* Expandable extras */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 py-1"
      >
        {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showMore ? "Menos campos" : "Mais campos (contato, trabalho, veículo)"}
      </button>

      {showMore && (
        <>
          <div className="ampara-card !p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Contato parcial</p>
            <div className="flex gap-2">
              <input
                type="text" className="ampara-input w-24" placeholder="DDD"
                value={form.ddd} onChange={e => set("ddd", e.target.value.replace(/\D/g, "").slice(0, 2))}
                maxLength={2}
              />
              <input
                type="text" className="ampara-input flex-1" placeholder="Final do telefone (2-4 dígitos)"
                value={form.final_telefone}
                onChange={e => set("final_telefone", e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
              />
            </div>
          </div>

          <div className="ampara-card !p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Trabalho / Veículo</p>
            <input
              type="text" className="ampara-input" placeholder="Profissão ou setor"
              value={form.profissao} onChange={e => set("profissao", e.target.value)} maxLength={60}
            />
            <input
              type="text" className="ampara-input" placeholder="Placa parcial (ex: ABC1)"
              value={form.placa_parcial}
              onChange={e => set("placa_parcial", e.target.value.toUpperCase().slice(0, 7))}
              maxLength={7}
            />
          </div>
        </>
      )}

      {/* Submit */}
      <button
        onClick={() => onSubmit(form)}
        disabled={loading || filledCount === 0}
        className="ampara-btn-primary flex items-center justify-center gap-2"
      >
        <Search className="w-4 h-4" />
        Buscar correspondências {filledCount > 0 && `(${filledCount} campo${filledCount > 1 ? "s" : ""})`}
      </button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        Quanto mais dados você informar, mais precisa será a busca.
        Nenhum dado completo é armazenado — apenas pistas parciais e mascaradas.
      </p>
    </div>
  );
}
