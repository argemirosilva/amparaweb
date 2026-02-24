import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TipoAlerta {
  id: string;
  grupo: string;
  codigo: string;
  label: string;
  descricao: string | null;
  ordem: number;
}

export function useTiposAlerta(grupos?: string[]) {
  return useQuery<TipoAlerta[]>({
    queryKey: ["tipos-alerta", grupos],
    queryFn: async () => {
      let query = supabase
        .from("tipos_alerta")
        .select("id, grupo, codigo, label, descricao, ordem")
        .eq("ativo", true)
        .order("grupo")
        .order("ordem");

      if (grupos?.length) {
        query = query.in("grupo", grupos);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
