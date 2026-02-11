import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticateSession(supabase: any, sessionToken: string) {
  if (!sessionToken) return null;
  const tokenHash = await hashToken(sessionToken);
  const { data } = await supabase
    .from("user_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  return data.user_id as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action, session_token, ...params } = body;

    const userId = await authenticateSession(supabase, session_token);
    if (!userId) {
      return json({ error: "Sessão inválida ou expirada" }, 401);
    }

    switch (action) {
      // ========== VÍTIMA ==========
      case "getMe": {
        const { data } = await supabase
          .from("usuarios")
          .select("id, nome_completo, email, telefone, data_nascimento, endereco_fixo, endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf, endereco_referencia, tem_filhos, mora_com_agressor, onboarding_completo, avatar_url")
          .eq("id", userId)
          .single();
        return json({ success: true, usuario: data });
      }

      case "updateMe": {
        const allowed = ["nome_completo", "telefone", "data_nascimento", "endereco_fixo", "endereco_cep", "endereco_logradouro", "endereco_numero", "endereco_complemento", "endereco_bairro", "endereco_cidade", "endereco_uf", "endereco_referencia", "tem_filhos", "mora_com_agressor", "onboarding_completo", "avatar_url"];
        const updates: Record<string, any> = {};
        for (const key of allowed) {
          if (params[key] !== undefined) updates[key] = params[key];
        }
        if (Object.keys(updates).length === 0) {
          return json({ error: "Nenhum campo para atualizar" }, 400);
        }
        const { error } = await supabase
          .from("usuarios")
          .update(updates)
          .eq("id", userId);
        if (error) return json({ error: "Erro ao atualizar perfil" }, 500);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "profile_updated", success: true,
          details: { fields: Object.keys(updates) },
        });
        return json({ success: true });
      }

      // ========== GUARDIÕES ==========
      case "getGuardioes": {
        const { data } = await supabase
          .from("guardioes")
          .select("id, nome, vinculo, telefone_whatsapp, created_at")
          .eq("usuario_id", userId)
          .order("created_at", { ascending: true });
        return json({ success: true, guardioes: data || [] });
      }

      case "createGuardiao": {
        const { nome, vinculo, telefone_whatsapp } = params;
        if (!nome?.trim() || !vinculo?.trim() || !telefone_whatsapp?.trim()) {
          return json({ error: "Nome, vínculo e telefone são obrigatórios" }, 400);
        }
        const { data, error } = await supabase
          .from("guardioes")
          .insert({ usuario_id: userId, nome: nome.trim(), vinculo: vinculo.trim(), telefone_whatsapp: telefone_whatsapp.replace(/\D/g, "") })
          .select("id")
          .single();
        if (error) return json({ error: "Erro ao criar guardião" }, 500);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "guardiao_created", success: true,
          details: { guardiao_id: data.id },
        });
        return json({ success: true, id: data.id }, 201);
      }

      case "updateGuardiao": {
        const { guardiao_id, ...guardiaoUpdates } = params;
        if (!guardiao_id) return json({ error: "guardiao_id obrigatório" }, 400);

        // Verify ownership
        const { data: existing } = await supabase
          .from("guardioes")
          .select("id")
          .eq("id", guardiao_id)
          .eq("usuario_id", userId)
          .maybeSingle();
        if (!existing) return json({ error: "Guardião não encontrado" }, 404);

        const allowed = ["nome", "vinculo", "telefone_whatsapp"];
        const upd: Record<string, any> = {};
        for (const k of allowed) {
          if (guardiaoUpdates[k] !== undefined) upd[k] = guardiaoUpdates[k];
        }
        if (upd.telefone_whatsapp) upd.telefone_whatsapp = upd.telefone_whatsapp.replace(/\D/g, "");

        await supabase.from("guardioes").update(upd).eq("id", guardiao_id);
        return json({ success: true });
      }

      case "deleteGuardiao": {
        const { guardiao_id } = params;
        if (!guardiao_id) return json({ error: "guardiao_id obrigatório" }, 400);

        const { data: existing } = await supabase
          .from("guardioes")
          .select("id")
          .eq("id", guardiao_id)
          .eq("usuario_id", userId)
          .maybeSingle();
        if (!existing) return json({ error: "Guardião não encontrado" }, 404);

        await supabase.from("guardioes").delete().eq("id", guardiao_id);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "guardiao_deleted", success: true,
          details: { guardiao_id },
        });
        return json({ success: true });
      }

      // ========== AGRESSOR ==========
      case "searchAgressor": {
        const { query } = params;
        if (!query || query.trim().length < 3) {
          return json({ error: "Query deve ter no mínimo 3 caracteres" }, 400);
        }

        const q = query.trim();
        const phoneDigits = q.replace(/\D/g, "");

        let results: any[] = [];

        // Search by phone if query looks like a phone number
        if (phoneDigits.length >= 8) {
          const { data } = await supabase
            .from("agressores")
            .select("id, nome, data_nascimento, forca_seguranca, tem_arma_em_casa")
            .ilike("telefone", `%${phoneDigits}%`)
            .limit(10);
          results = data || [];
        } else {
          // Search by name
          const { data } = await supabase
            .from("agressores")
            .select("id, nome, data_nascimento, forca_seguranca, tem_arma_em_casa")
            .ilike("nome", `%${q}%`)
            .limit(10);
          results = data || [];
        }

        // Anonymize results: partial name, year only, count of links
        const anonymized = await Promise.all(results.map(async (a) => {
          const { count } = await supabase
            .from("vitimas_agressores")
            .select("id", { count: "exact", head: true })
            .eq("agressor_id", a.id);

          // Mask name: "João Silva" → "J*** S***"
          const maskedName = a.nome.split(" ").map((w: string) =>
            w.length <= 1 ? w : w[0] + "*".repeat(Math.min(w.length - 1, 3))
          ).join(" ");

          return {
            id: a.id,
            nome_parcial: maskedName,
            ano_nascimento: a.data_nascimento ? new Date(a.data_nascimento).getFullYear() : null,
            forca_seguranca: a.forca_seguranca,
            tem_arma_em_casa: a.tem_arma_em_casa,
            total_vinculos: count || 0,
          };
        }));

        return json({ success: true, resultados: anonymized });
      }

      case "createAgressor": {
        const { nome, data_nascimento, telefone, nome_pai_parcial, nome_mae_parcial, forca_seguranca, tem_arma_em_casa, tipo_vinculo } = params;
        if (!nome?.trim()) return json({ error: "Nome do agressor é obrigatório" }, 400);
        if (!tipo_vinculo?.trim()) return json({ error: "Tipo de vínculo é obrigatório" }, 400);

        // Create aggressor record
        const { data: agressor, error: aErr } = await supabase
          .from("agressores")
          .insert({
            nome: nome.trim(),
            data_nascimento: data_nascimento || null,
            telefone: telefone ? telefone.replace(/\D/g, "") : null,
            nome_pai_parcial: nome_pai_parcial?.trim() || null,
            nome_mae_parcial: nome_mae_parcial?.trim() || null,
            forca_seguranca: forca_seguranca || false,
            tem_arma_em_casa: tem_arma_em_casa || false,
          })
          .select("id")
          .single();

        if (aErr) {
          console.error("Create agressor error:", aErr);
          return json({ error: "Erro ao criar ficha do agressor" }, 500);
        }

        // Create link
        const { error: lErr } = await supabase
          .from("vitimas_agressores")
          .insert({
            usuario_id: userId,
            agressor_id: agressor.id,
            tipo_vinculo: tipo_vinculo.trim(),
          });

        if (lErr) {
          console.error("Link error:", lErr);
          return json({ error: "Erro ao vincular agressor" }, 500);
        }

        await supabase.from("audit_logs").insert([
          { user_id: userId, action_type: "aggressor_created", success: true, details: { agressor_id: agressor.id } },
          { user_id: userId, action_type: "aggressor_linked", success: true, details: { agressor_id: agressor.id, tipo_vinculo } },
        ]);

        return json({ success: true, agressor_id: agressor.id }, 201);
      }

      case "linkAgressor": {
        const { agressor_id, tipo_vinculo } = params;
        if (!agressor_id || !tipo_vinculo?.trim()) {
          return json({ error: "agressor_id e tipo_vinculo são obrigatórios" }, 400);
        }

        // Check agressor exists
        const { data: ag } = await supabase
          .from("agressores")
          .select("id")
          .eq("id", agressor_id)
          .maybeSingle();
        if (!ag) return json({ error: "Agressor não encontrado" }, 404);

        // Check not already linked
        const { data: existing } = await supabase
          .from("vitimas_agressores")
          .select("id")
          .eq("usuario_id", userId)
          .eq("agressor_id", agressor_id)
          .maybeSingle();
        if (existing) return json({ error: "Agressor já vinculado" }, 409);

        const { error } = await supabase
          .from("vitimas_agressores")
          .insert({ usuario_id: userId, agressor_id, tipo_vinculo: tipo_vinculo.trim() });
        if (error) return json({ error: "Erro ao vincular" }, 500);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "aggressor_linked", success: true,
          details: { agressor_id, tipo_vinculo },
        });

        return json({ success: true }, 201);
      }

      case "getMyAgressores": {
        const { data } = await supabase
          .from("vitimas_agressores")
          .select("id, tipo_vinculo, status_relacao, agressor_id, created_at")
          .eq("usuario_id", userId)
          .order("created_at", { ascending: true });

        // Enrich with agressor details (only the user's own links)
        const enriched = await Promise.all((data || []).map(async (v: any) => {
          const { data: ag } = await supabase
            .from("agressores")
            .select("nome, data_nascimento, telefone, forca_seguranca, tem_arma_em_casa")
            .eq("id", v.agressor_id)
            .single();
          return { ...v, agressor: ag };
        }));

        return json({ success: true, vinculos: enriched });
      }

      case "updateVinculo": {
        const { vinculo_id, tipo_vinculo, status_relacao } = params;
        if (!vinculo_id) return json({ error: "vinculo_id obrigatório" }, 400);

        const { data: existing } = await supabase
          .from("vitimas_agressores")
          .select("id")
          .eq("id", vinculo_id)
          .eq("usuario_id", userId)
          .maybeSingle();
        if (!existing) return json({ error: "Vínculo não encontrado" }, 404);

        const upd: Record<string, any> = {};
        if (tipo_vinculo) upd.tipo_vinculo = tipo_vinculo;
        if (status_relacao !== undefined) upd.status_relacao = status_relacao;

        await supabase.from("vitimas_agressores").update(upd).eq("id", vinculo_id);
        return json({ success: true });
      }

      case "deleteVinculo": {
        const { vinculo_id } = params;
        if (!vinculo_id) return json({ error: "vinculo_id obrigatório" }, 400);

        const { data: existing } = await supabase
          .from("vitimas_agressores")
          .select("id")
          .eq("id", vinculo_id)
          .eq("usuario_id", userId)
          .maybeSingle();
        if (!existing) return json({ error: "Vínculo não encontrado" }, 404);

        await supabase.from("vitimas_agressores").delete().eq("id", vinculo_id);

        await supabase.from("audit_logs").insert({
          user_id: userId, action_type: "aggressor_unlinked", success: true,
          details: { vinculo_id },
        });
        return json({ success: true });
      }

      default:
        return json({ error: `Action desconhecida: ${action}` }, 400);
    }
  } catch (err) {
    console.error("web-api error:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
