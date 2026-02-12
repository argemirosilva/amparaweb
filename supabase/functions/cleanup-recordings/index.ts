import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.4";

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

function getR2Client() {
  return new AwsClient({
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    service: "s3",
    region: "auto",
  });
}

function r2Url(key: string) {
  return `https://${Deno.env.get("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${Deno.env.get("R2_BUCKET_NAME")}/${key}`;
}

async function deleteFromR2(storagePath: string): Promise<boolean> {
  try {
    const r2 = getR2Client();
    const response = await r2.fetch(r2Url(storagePath), { method: "DELETE" });
    return response.ok || response.status === 404;
  } catch (e) {
    console.error(`R2 delete error for ${storagePath}:`, e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all users with their retention settings
    const { data: users, error: usersErr } = await supabase
      .from("usuarios")
      .select("id, retencao_dias_sem_risco");

    if (usersErr) {
      console.error("Users query error:", usersErr);
      return json({ error: "Erro ao buscar usuários" }, 500);
    }

    let totalDeleted = 0;
    let totalErrors = 0;

    for (const user of (users || [])) {
      const retentionDays = user.retencao_dias_sem_risco ?? 7;
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: candidates, error: queryErr } = await supabase
        .from("gravacoes")
        .select("id, storage_path, gravacoes_analises!inner(nivel_risco)")
        .eq("user_id", user.id)
        .eq("status", "processado")
        .lt("created_at", cutoff)
        .eq("gravacoes_analises.nivel_risco", "sem_risco");

      if (queryErr || !candidates || candidates.length === 0) continue;

      for (const g of candidates) {
        try {
          if (g.storage_path) {
            const r2Ok = await deleteFromR2(g.storage_path);
            if (!r2Ok) {
              console.error(`Failed to delete R2 file: ${g.storage_path}`);
              totalErrors++;
              continue;
            }
          }

          await supabase.from("gravacoes_analises").delete().eq("gravacao_id", g.id);
          await supabase.from("gravacoes").delete().eq("id", g.id);
          totalDeleted++;
        } catch (e) {
          console.error(`Error cleaning recording ${g.id}:`, e);
          totalErrors++;
        }
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action_type: "cleanup_sem_risco",
      success: true,
      details: { deleted: totalDeleted, errors: totalErrors },
    });

    console.log(`Cleanup done: ${totalDeleted} deleted, ${totalErrors} errors.`);
    return json({ success: true, deleted: totalDeleted, errors: totalErrors });
  } catch (err) {
    console.error("cleanup-recordings error:", err);
    return json({ error: "Erro interno na limpeza" }, 500);
  }
});
