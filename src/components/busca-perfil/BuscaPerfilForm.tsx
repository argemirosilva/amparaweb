import { useState } from "react";
import { Search, ChevronDown, ChevronUp, User, Users, MapPin, Phone, Briefcase, Fingerprint } from "lucide-react";
import { type SearchFormData, emptySearchForm } from "@/pages/BuscaPerfil";

interface Props {
  onSubmit: (data: SearchFormData) => void;
  loading: boolean;
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
  );
}

export function BuscaPerfilForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<SearchFormData>(emptySearchForm);
  const [showMore, setShowMore] = useState(false);

  const set = (field: keyof SearchFormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const filledCount = Object.values(form).filter(v => v.trim()).length;

  return (
    <div className="space-y-4">
      {/* Identificação */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <SectionHeader icon={User} title="Identificação" />
        <div className="space-y-2.5">
          <input
            type="text" className="ampara-input" placeholder="Nome (parcial ou completo)"
            value={form.nome} onChange={e => set("nome", e.target.value)} maxLength={100}
          />
          <input
            type="text" className="ampara-input" placeholder="CPF (parcial ou completo)"
            value={form.cpf} onChange={e => set("cpf", e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={11}
          />
          <input
            type="number" className="ampara-input" placeholder="Idade aproximada"
            value={form.idade_aprox} onChange={e => set("idade_aprox", e.target.value)}
            min={15} max={100}
          />
        </div>
      </div>

      {/* Família */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <SectionHeader icon={Users} title="Família (só 1º nome basta)" />
        <div className="space-y-2.5">
          <input
            type="text" className="ampara-input" placeholder="Primeiro nome da mãe"
            value={form.nome_mae} onChange={e => set("nome_mae", e.target.value)} maxLength={50}
          />
          <input
            type="text" className="ampara-input" placeholder="Primeiro nome do pai"
            value={form.nome_pai} onChange={e => set("nome_pai", e.target.value)} maxLength={50}
          />
        </div>
      </div>

      {/* Localização */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <SectionHeader icon={MapPin} title="Localização aproximada" />
        <div className="space-y-2.5">
          <input
            type="text" className="ampara-input" placeholder="Cidade/UF (ex: São Paulo/SP)"
            value={form.cidade_uf} onChange={e => set("cidade_uf", e.target.value)} maxLength={60}
          />
          <input
            type="text" className="ampara-input" placeholder="Bairro ou região"
            value={form.bairro} onChange={e => set("bairro", e.target.value)} maxLength={60}
          />
        </div>
      </div>

      {/* Expandable extras */}
      <button
        onClick={() => setShowMore(!showMore)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
      >
        {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showMore ? "Menos campos" : "Mais campos (contato, trabalho, veículo...)"}
      </button>

      {showMore && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Contato */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <SectionHeader icon={Phone} title="Contato parcial" />
            <div className="flex gap-2.5">
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

          {/* Trabalho / Veículo */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <SectionHeader icon={Briefcase} title="Trabalho / Veículo" />
            <div className="space-y-2.5">
              <input
                type="text" className="ampara-input" placeholder="Profissão ou setor"
                value={form.profissao} onChange={e => set("profissao", e.target.value)} maxLength={60}
              />
              <input
                type="text" className="ampara-input" placeholder="Empresa ou local de trabalho"
                value={form.empresa} onChange={e => set("empresa", e.target.value)} maxLength={80}
              />
              <input
                type="text" className="ampara-input" placeholder="Placa parcial (ex: ABC1)"
                value={form.placa_parcial}
                onChange={e => set("placa_parcial", e.target.value.toUpperCase().slice(0, 7))}
                maxLength={7}
              />
            </div>
          </div>

          {/* Características */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <SectionHeader icon={Fingerprint} title="Características" />
            <div className="space-y-2.5">
              <select
                className="ampara-input"
                value={form.cor_raca} onChange={e => set("cor_raca", e.target.value)}
              >
                <option value="">Cor/Raça (não sei)</option>
                <option value="Branca">Branca</option>
                <option value="Preta">Preta</option>
                <option value="Parda">Parda</option>
                <option value="Indígena">Indígena</option>
                <option value="Amarela">Amarela</option>
              </select>
              <select
                className="ampara-input"
                value={form.escolaridade} onChange={e => set("escolaridade", e.target.value)}
              >
                <option value="">Escolaridade (não sei)</option>
                <option value="Fundamental incompleto">Fundamental incompleto</option>
                <option value="Fundamental completo">Fundamental completo</option>
                <option value="Médio incompleto">Médio incompleto</option>
                <option value="Médio completo">Médio completo</option>
                <option value="Superior incompleto">Superior incompleto</option>
                <option value="Superior completo">Superior completo</option>
                <option value="Pós-graduação">Pós-graduação</option>
              </select>
              <select
                className="ampara-input"
                value={form.forca_seguranca} onChange={e => set("forca_seguranca", e.target.value)}
              >
                <option value="">Força de segurança? (não sei)</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Filled count indicator */}
      {filledCount > 0 && (
        <div className="flex items-center justify-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: Math.min(filledCount, 8) }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary" />
            ))}
            {Array.from({ length: Math.max(0, 5 - filledCount) }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-muted" />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {filledCount} campo{filledCount > 1 ? "s" : ""} preenchido{filledCount > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={() => onSubmit(form)}
        disabled={loading || filledCount < 5}
        className="ampara-btn-primary flex items-center justify-center gap-2"
      >
        <Search className="w-4 h-4" />
        {filledCount < 5
          ? `Preencha pelo menos 5 campos`
          : `Buscar correspondências`}
      </button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        Quanto mais dados você informar, mais precisa será a busca.
        Nenhum dado completo é armazenado.
      </p>
    </div>
  );
}
