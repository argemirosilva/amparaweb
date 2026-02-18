import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

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

function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
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

    // ========== CREATE USER (Admin invite) ==========
    if (action === "createUser") {
      const { nome_completo, email, tenant_id, role, app_url } = params;

      if (!nome_completo?.trim() || !email?.trim()) {
        return json({ error: "Nome e email são obrigatórios" }, 400);
      }

      const emailClean = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailClean)) {
        return json({ error: "Email inválido" }, 400);
      }

      if (!tenant_id) {
        return json({ error: "Órgão é obrigatório" }, 400);
      }

      const validRole = role === "admin_tenant" ? "admin_tenant" : "operador";

      // Check if email already exists
      const { data: existing } = await supabase
        .from("usuarios")
        .select("id")
        .eq("email", emailClean)
        .maybeSingle();

      if (existing) {
        return json({ error: "Este email já está cadastrado" }, 409);
      }

      // Generate invite token and random unusable password
      const inviteToken = generateSecureToken(32);
      const tokenExpira = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h
      const randomPassword = generateSecureToken(32);
      const senhaHash = bcrypt.hashSync(randomPassword);

      // Insert user
      const { data: newUser, error: insertError } = await supabase
        .from("usuarios")
        .insert({
          nome_completo: nome_completo.trim(),
          email: emailClean,
          telefone: "",
          senha_hash: senhaHash,
          status: "pendente",
          email_verificado: false,
          codigo_verificacao: inviteToken,
          codigo_verificacao_expira: tokenExpira,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Insert user error:", insertError);
        return json({ error: "Erro ao criar usuário: " + insertError.message }, 500);
      }

      // Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: newUser.id,
          role: validRole,
          tenant_id: tenant_id,
        });

      if (roleError) {
        console.error("Insert role error:", roleError);
        // Rollback user creation
        await supabase.from("usuarios").delete().eq("id", newUser.id);
        return json({ error: "Erro ao atribuir papel: " + roleError.message }, 500);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action_type: "admin_create_user",
        success: true,
        details: { created_user_id: newUser.id, email: emailClean, role: validRole, tenant_id },
      });

      // Send invite email
      const baseUrl = app_url || "https://ampamamulher.lovable.app";
      const setupLink = `${baseUrl}/configurar-conta?token=${inviteToken}&email=${encodeURIComponent(emailClean)}`;

      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auth-send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            email: emailClean,
            nome: nome_completo.trim(),
            tipo: "convite",
            link: setupLink,
          }),
        });
      } catch (e) {
        console.error("Email send error:", e);
      }

      return json({ success: true, user_id: newUser.id });
    }

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
