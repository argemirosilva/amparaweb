import { useState, useCallback } from "react";
import { buscarCep, formatCep, CepResult } from "@/services/cepService";

export interface EnderecoFields {
  endereco_cep: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_referencia: string;
}

export const emptyEndereco: EnderecoFields = {
  endereco_cep: "",
  endereco_logradouro: "",
  endereco_numero: "",
  endereco_complemento: "",
  endereco_bairro: "",
  endereco_cidade: "",
  endereco_uf: "",
  endereco_referencia: "",
};

interface Props {
  value: EnderecoFields;
  onChange: (fields: EnderecoFields) => void;
  disabled?: boolean;
}

export function EnderecoForm({ value, onChange, disabled }: Props) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepError, setCepError] = useState("");

  const handleCepChange = useCallback(async (raw: string) => {
    const formatted = formatCep(raw);
    onChange({ ...value, endereco_cep: formatted });
    setCepError("");

    const digits = raw.replace(/\D/g, "");
    if (digits.length === 8) {
      setBuscandoCep(true);
      const result = await buscarCep(digits);
      setBuscandoCep(false);
      if (result) {
        onChange({
          ...value,
          endereco_cep: formatted,
          endereco_logradouro: result.logradouro || value.endereco_logradouro,
          endereco_bairro: result.bairro || value.endereco_bairro,
          endereco_cidade: result.localidade || value.endereco_cidade,
          endereco_uf: result.uf || value.endereco_uf,
          endereco_complemento: result.complemento || value.endereco_complemento,
        });
      } else {
        setCepError("CEP não encontrado");
      }
    }
  }, [value, onChange]);

  const set = (field: keyof EnderecoFields, v: string) => onChange({ ...value, [field]: v });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">CEP</label>
        <div className="relative">
          <input type="text" className="ampara-input" placeholder="00000-000"
            value={value.endereco_cep} disabled={disabled}
            onChange={e => handleCepChange(e.target.value)} maxLength={9} />
          {buscandoCep && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
              Buscando...
            </span>
          )}
        </div>
        {cepError && <p className="text-xs text-destructive mt-1">{cepError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Logradouro</label>
        <input type="text" className="ampara-input" placeholder="Rua, Avenida..."
          value={value.endereco_logradouro} disabled={disabled} maxLength={200}
          onChange={e => set("endereco_logradouro", e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Número</label>
          <input type="text" className="ampara-input" placeholder="Nº"
            value={value.endereco_numero} disabled={disabled} maxLength={10}
            onChange={e => set("endereco_numero", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-foreground mb-1.5">Complemento</label>
          <input type="text" className="ampara-input" placeholder="Apto, Bloco..."
            value={value.endereco_complemento} disabled={disabled} maxLength={100}
            onChange={e => set("endereco_complemento", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Bairro</label>
        <input type="text" className="ampara-input" placeholder="Bairro"
          value={value.endereco_bairro} disabled={disabled} maxLength={100}
          onChange={e => set("endereco_bairro", e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-foreground mb-1.5">Cidade</label>
          <input type="text" className="ampara-input" placeholder="Cidade"
            value={value.endereco_cidade} disabled={disabled} maxLength={100}
            onChange={e => set("endereco_cidade", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">UF</label>
          <input type="text" className="ampara-input" placeholder="UF"
            value={value.endereco_uf} disabled={disabled} maxLength={2}
            onChange={e => set("endereco_uf", e.target.value.toUpperCase())} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Referência</label>
        <input type="text" className="ampara-input" placeholder="Próximo ao mercado, casa amarela..."
          value={value.endereco_referencia} disabled={disabled} maxLength={300}
          onChange={e => set("endereco_referencia", e.target.value)} />
        <p className="text-xs text-muted-foreground mt-1">Informações que facilitem a localização</p>
      </div>
    </div>
  );
}
