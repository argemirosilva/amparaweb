export interface CepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

const cache = new Map<string, { data: CepResult; ts: number }>();
const TTL = 10 * 60 * 1000; // 10 min

export async function buscarCep(cep: string): Promise<CepResult | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const cached = cache.get(digits);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(6000),
    });
    const data: CepResult = await res.json();
    if (data.erro) return null;
    cache.set(digits, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
