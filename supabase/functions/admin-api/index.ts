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

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function authenticateAdmin(supabase: any, sessionToken: string): Promise<string | null> {
  if (!sessionToken) return null;
  const tokenHash = await hashToken(sessionToken);
  const { data: session } = await supabase
    .from("user_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!session || new Date(session.expires_at) < new Date()) return null;

  // Check admin role
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id);

  const hasAdmin = (roles || []).some(
    (r: any) => r.role === "admin_master" || r.role === "admin_tenant"
  );
  if (!hasAdmin) return null;
  return session.user_id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { action, session_token, ...params } = body;

    if (!session_token) return json({ error: "Sessão não informada" }, 401);

    const userId = await authenticateAdmin(supabase, session_token);
    if (!userId) return json({ error: "Acesso negado. Permissão de administrador necessária." }, 403);

    // ========== TENANTS ==========
    if (action === "listTenants") {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("nome");
      if (error) return json({ error: error.message }, 500);
      return json({ tenants: data });
    }

    if (action === "createTenant") {
      const { tenant } = params;
      if (!tenant?.nome || !tenant?.sigla) return json({ error: "Nome e sigla são obrigatórios" }, 400);
      const { data, error } = await supabase
        .from("tenants")
        .insert(tenant)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ tenant: data });
    }

    if (action === "updateTenant") {
      const { id, updates } = params;
      if (!id) return json({ error: "ID não informado" }, 400);
      const { data, error } = await supabase
        .from("tenants")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ tenant: data });
    }

    if (action === "deleteTenant") {
      const { id } = params;
      if (!id) return json({ error: "ID não informado" }, 400);
      const { error } = await supabase
        .from("tenants")
        .delete()
        .eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ========== ADMIN SETTINGS ==========
    if (action === "listSettings") {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("*")
        .order("categoria")
        .order("chave");
      if (error) return json({ error: error.message }, 500);
      return json({ settings: data });
    }

    if (action === "updateSetting") {
      const { id, valor } = params;
      if (!id || valor === undefined) return json({ error: "ID e valor são obrigatórios" }, 400);
      const { data, error } = await supabase
        .from("admin_settings")
        .update({ valor: String(valor), updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ setting: data });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    return json({ error: err.message || "Erro interno" }, 500);
  }
});
