import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── MP3 helpers ──

/** Strip ID3v2 header from an MP3 buffer so concatenation doesn't confuse decoders */
function stripId3Header(buf: Uint8Array): Uint8Array {
  // ID3v2 tag starts with "ID3"
  if (buf.length >= 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    // ID3v2 size is stored in 4 bytes (synchsafe integer) at offset 6-9
    const size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9];
    const headerSize = 10 + size;
    if (headerSize < buf.length) {
      return buf.subarray(headerSize);
    }
  }
  return buf;
}

// ── R2 helpers ──

function getR2Config() {
  return {
    accountId: Deno.env.get("R2_ACCOUNT_ID")!,
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    bucketName: Deno.env.get("R2_BUCKET_NAME")!,
    publicUrl: Deno.env.get("R2_PUBLIC_URL") || "",
  };
}

async function signR2Request(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Uint8Array | null,
  config: ReturnType<typeof getR2Config>
): Promise<Record<string, string>> {
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const shortDate = dateStamp.substring(0, 8);
  const region = "auto";
  const service = "s3";
  const host = `${config.accountId}.r2.cloudflarestorage.com`;

  const canonicalUri = `/${config.bucketName}/${path}`;
  const canonicalQueryString = "";

  const allHeaders: Record<string, string> = {
    ...headers,
    host,
    "x-amz-date": dateStamp,
    "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
  };

  const signedHeaderKeys = Object.keys(allHeaders).sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${allHeaders[k]}\n`).join("");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const encoder = new TextEncoder();
  const crHash = await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest));
  const crHashHex = Array.from(new Uint8Array(crHash), (b) => b.toString(16).padStart(2, "0")).join("");

  const credentialScope = `${shortDate}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${dateStamp}\n${credentialScope}\n${crHashHex}`;

  async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key instanceof Uint8Array ? key : new Uint8Array(key),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  }

  const kDate = await hmacSha256(encoder.encode(`AWS4${config.secretAccessKey}`), shortDate);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");

  const signature = Array.from(
    new Uint8Array(await hmacSha256(kSigning, stringToSign)),
    (b) => b.toString(16).padStart(2, "0")
  ).join("");

  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    ...allHeaders,
    Authorization: authorization,
  };
}

async function downloadFromR2(storagePath: string, config: ReturnType<typeof getR2Config>): Promise<Uint8Array | null> {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const headers = await signR2Request("GET", storagePath, {}, null, config);
  const url = `https://${host}/${config.bucketName}/${storagePath}`;

  try {
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) {
      console.error(`R2 download failed for ${storagePath}: ${res.status}`);
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    console.error(`R2 download error for ${storagePath}:`, err);
    return null;
  }
}

async function uploadToR2(storagePath: string, data: Uint8Array, config: ReturnType<typeof getR2Config>): Promise<boolean> {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const headers = await signR2Request("PUT", storagePath, { "content-type": "application/octet-stream" }, data, config);
  const url = `https://${host}/${config.bucketName}/${storagePath}`;

  try {
    const res = await fetch(url, { method: "PUT", headers, body: data });
    return res.ok;
  } catch (err) {
    console.error(`R2 upload error for ${storagePath}:`, err);
    return false;
  }
}

async function deleteFromR2(storagePath: string, config: ReturnType<typeof getR2Config>): Promise<boolean> {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const headers = await signR2Request("DELETE", storagePath, {}, null, config);
  const url = `https://${host}/${config.bucketName}/${storagePath}`;

  try {
    const res = await fetch(url, { method: "DELETE", headers });
    return res.ok || res.status === 404; // 404 is ok for idempotent delete
  } catch (err) {
    console.error(`R2 delete error for ${storagePath}:`, err);
    return false;
  }
}

async function checkR2Exists(storagePath: string, config: ReturnType<typeof getR2Config>): Promise<boolean> {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const headers = await signR2Request("HEAD", storagePath, {}, null, config);
  const url = `https://${host}/${config.bucketName}/${storagePath}`;

  try {
    const res = await fetch(url, { method: "HEAD", headers });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Main logic ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> | null = null;
    try {
      body = await req.json();
    } catch { /* no body or invalid json — ok for cron */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const r2Config = getR2Config();
    const results: Record<string, unknown>[] = [];

    // ── Step 0: Auto-expire orphan sessions (ativa > 10 min without segments) ──
    const orphanCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: orphanSessions } = await supabase
      .from("monitoramento_sessoes")
      .select("id, user_id")
      .in("status", ["ativa", "aguardando_dispositivo"])
      .lt("created_at", orphanCutoff);

    if (orphanSessions && orphanSessions.length > 0) {
      for (const session of orphanSessions) {
        // Check if session has any segments
        const { count } = await supabase
          .from("gravacoes_segmentos")
          .select("id", { count: "exact", head: true })
          .eq("monitor_session_id", session.id);

        if ((count || 0) === 0) {
          const now = new Date().toISOString();
          await supabase
            .from("monitoramento_sessoes")
            .update({
              status: "aguardando_finalizacao",
              closed_at: now,
              sealed_reason: "sem_segmentos_auto",
              finalizado_em: now,
            })
            .eq("id", session.id);

          await supabase.from("audit_logs").insert({
            user_id: session.user_id,
            action_type: "session_sealed",
            success: true,
            details: { session_id: session.id, sealed_reason: "sem_segmentos_auto" },
          });

          // Reset device flags
          await supabase
            .from("device_status")
            .update({ is_recording: false, is_monitoring: false })
            .eq("user_id", session.user_id);

          results.push({ action: "orphan_expired", session_id: session.id });
          console.log(`Auto-expired orphan session ${session.id} (no segments after 10min)`);
        }
      }
    }

    // ── Step 0b: Auto-expire sessions paused by interruption > 5 min ──
    // These are ativa sessions where is_recording=false for > 5 min (pausada_interrupcao)
    const interruptCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: pausedDevices } = await supabase
      .from("device_status")
      .select("user_id, device_id")
      .eq("is_recording", false)
      .eq("is_monitoring", false)
      .lt("updated_at", interruptCutoff);

    if (pausedDevices && pausedDevices.length > 0) {
      for (const dev of pausedDevices) {
        // Find ativa sessions for this user+device that have segments (not orphans)
        const { data: pausedSessions } = await supabase
          .from("monitoramento_sessoes")
          .select("id, user_id")
          .eq("user_id", dev.user_id)
          .eq("device_id", dev.device_id)
          .eq("status", "ativa");

        if (pausedSessions) {
          for (const session of pausedSessions) {
            // Check last segment time
            const { data: lastSeg } = await supabase
              .from("gravacoes_segmentos")
              .select("created_at")
              .eq("monitor_session_id", session.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastSeg && lastSeg.created_at < interruptCutoff) {
              const now = new Date().toISOString();
              await supabase
                .from("monitoramento_sessoes")
                .update({
                  status: "aguardando_finalizacao",
                  closed_at: now,
                  sealed_reason: "interrupcao_timeout",
                  finalizado_em: now,
                })
                .eq("id", session.id);

              await supabase.from("audit_logs").insert({
                user_id: session.user_id,
                action_type: "session_sealed",
                success: true,
                details: { session_id: session.id, sealed_reason: "interrupcao_timeout" },
              });

              results.push({ action: "interrupcao_timeout", session_id: session.id });
              console.log(`Auto-expired interrupted session ${session.id} (paused > 5min)`);
            }
          }
        }
      }
    }

    // ── Step 1: Expire active/aguardando sessions whose window_end_at has passed ──
    const { data: expiredSessions } = await supabase
      .from("monitoramento_sessoes")
      .select("id, user_id")
      .in("status", ["ativa", "aguardando_dispositivo"])
      .not("window_end_at", "is", null)
      .lt("window_end_at", new Date().toISOString());

    if (expiredSessions && expiredSessions.length > 0) {
      for (const session of expiredSessions) {
        const now = new Date().toISOString();
        await supabase
          .from("monitoramento_sessoes")
          .update({
            status: "aguardando_finalizacao",
            closed_at: now,
            sealed_reason: "window_expired",
            finalizado_em: now,
          })
          .eq("id", session.id);

        // Reset device flags — monitoring window has ended
        await supabase
          .from("device_status")
          .update({ is_recording: false, is_monitoring: false })
          .eq("user_id", session.user_id);

        await supabase.from("audit_logs").insert({
          user_id: session.user_id,
          action_type: "session_sealed",
          success: true,
          details: { session_id: session.id, sealed_reason: "window_expired" },
        });

        results.push({ action: "expired", session_id: session.id });
      }
    }

    // ── Step 2: Process sessions awaiting finalization (with 30s tolerance unless skipped) ──
    const skipTolerance = body?.skip_tolerance === true;
    const cutoff = skipTolerance
      ? new Date().toISOString()
      : new Date(Date.now() - 30 * 1000).toISOString();

    const { data: pendingSessions } = await supabase
      .from("monitoramento_sessoes")
      .select("id, user_id, device_id, origem, closed_at, finalizado_em")
      .eq("status", "aguardando_finalizacao")
      .or(`closed_at.lt.${cutoff},and(closed_at.is.null,finalizado_em.lt.${cutoff})`);

    if (pendingSessions && pendingSessions.length > 0) {
      for (const session of pendingSessions) {
        try {
          // Idempotency: check if a gravacao already exists for this session
          const { data: existingGravacao } = await supabase
            .from("gravacoes")
            .select("id")
            .eq("monitor_session_id", session.id)
            .maybeSingle();

          if (existingGravacao) {
            // Already processed — just mark session as finalizada
            await supabase.from("monitoramento_sessoes").update({
              status: "finalizada",
              final_gravacao_id: existingGravacao.id,
            }).eq("id", session.id);
            results.push({ action: "already_processed", session_id: session.id });
            continue;
          }
          // Fetch segments ordered by index
          const { data: segments } = await supabase
            .from("gravacoes_segmentos")
            .select("id, storage_path, file_url, duracao_segundos, segmento_idx")
            .eq("monitor_session_id", session.id)
            .order("segmento_idx", { ascending: true });

          if (!segments || segments.length === 0) {
            // No segments — recording was too short, discard session entirely
            await supabase
              .from("monitoramento_sessoes")
              .delete()
              .eq("id", session.id);

            console.log(`Discarded empty session ${session.id} (0 segments)`);

            await supabase.from("audit_logs").insert({
              user_id: session.user_id,
              action_type: "session_discarded_short",
              success: true,
              details: { session_id: session.id, reason: "zero_segments_maintenance" },
            });

            results.push({ action: "discarded_empty", session_id: session.id });
            continue;
          }

          // ── Download and concatenate segments ──
          const buffers: Uint8Array[] = [];
          let downloadFailed = false;

          for (const seg of segments) {
            const path = seg.storage_path || seg.file_url;
            if (!path) {
              console.error(`Segment ${seg.id} has no storage_path or file_url`);
              downloadFailed = true;
              break;
            }

            const data = await downloadFromR2(path, r2Config);
            if (!data) {
              console.error(`Failed to download segment ${seg.id} from ${path}`);
              downloadFailed = true;
              break;
            }
            buffers.push(data);
          }

          if (downloadFailed) {
            await supabase.from("audit_logs").insert({
              user_id: session.user_id,
              action_type: "session_concatenation_error",
              success: false,
              details: { session_id: session.id, error: "segment_download_failed" },
            });
            results.push({ action: "download_error", session_id: session.id });
            continue;
          }

          // Determine final extension from first segment
          const firstSegPath = segments[0].storage_path || segments[0].file_url || "";
          const segExt = firstSegPath.split(".").pop()?.toLowerCase() || "mp3";
          const finalExt = (segExt === "ogg" || segExt === "mp3" || segExt === "wav") ? segExt : "mp3";

          // Concatenate binary — strip ID3 tags from subsequent MP3 segments
          // to avoid confusing decoders with multiple headers
          const strippedBuffers: Uint8Array[] = [];
          for (let i = 0; i < buffers.length; i++) {
            let buf = buffers[i];
            if (i > 0 && finalExt === "mp3") {
              buf = stripId3Header(buf);
            }
            strippedBuffers.push(buf);
          }
          const totalSize = strippedBuffers.reduce((sum, b) => sum + b.length, 0);
          const concatenated = new Uint8Array(totalSize);
          let offset = 0;
          for (const buf of strippedBuffers) {
            concatenated.set(buf, offset);
            offset += buf.length;
          }
          const dateStr = new Date().toISOString().split("T")[0];
          const finalPath = `${session.user_id}/${dateStr}/${session.id}.${finalExt}`;

          // Upload final file
          const uploaded = await uploadToR2(finalPath, concatenated, r2Config);
          if (!uploaded) {
            await supabase.from("audit_logs").insert({
              user_id: session.user_id,
              action_type: "session_concatenation_error",
              success: false,
              details: { session_id: session.id, error: "final_upload_failed" },
            });
            results.push({ action: "upload_error", session_id: session.id });
            continue;
          }

          // Calculate total duration
          let totalDuration = 0;
          for (const seg of segments) {
            totalDuration += seg.duracao_segundos || 30;
          }

          // Verify final file exists
          const finalExists = await checkR2Exists(finalPath, r2Config);
          if (!finalExists) {
            await supabase.from("audit_logs").insert({
              user_id: session.user_id,
              action_type: "session_concatenation_error",
              success: false,
              details: { session_id: session.id, error: "final_file_not_found_after_upload" },
            });
            results.push({ action: "verify_error", session_id: session.id });
            continue;
          }

          // Insert gravacao
          const { data: gravacao } = await supabase
            .from("gravacoes")
            .insert({
              user_id: session.user_id,
              device_id: session.device_id,
              storage_path: finalPath,
              file_url: r2Config.publicUrl ? `${r2Config.publicUrl}/${finalPath}` : finalPath,
              duracao_segundos: totalDuration,
              status: "pendente",
              monitor_session_id: session.id,
            })
            .select("id")
            .single();

          if (!gravacao) {
            await supabase.from("audit_logs").insert({
              user_id: session.user_id,
              action_type: "session_concatenation_error",
              success: false,
              details: { session_id: session.id, error: "gravacao_insert_failed" },
            });
            results.push({ action: "insert_error", session_id: session.id });
            continue;
          }

          // Update session
          await supabase
            .from("monitoramento_sessoes")
            .update({
              status: "inserida_no_fluxo",
              total_segments: segments.length,
              total_duration_seconds: totalDuration,
              final_gravacao_id: gravacao.id,
            })
            .eq("id", session.id);

          // Audit concatenation
          await supabase.from("audit_logs").insert({
            user_id: session.user_id,
            action_type: "session_concatenated",
            success: true,
            details: {
              session_id: session.id,
              final_gravacao_id: gravacao.id,
              total_segments: segments.length,
              total_duration: totalDuration,
            },
          });

          // ── Safe cleanup: delete segment files and records ──
          let cleanupCount = 0;
          for (const seg of segments) {
            const segPath = seg.storage_path || seg.file_url;
            if (segPath) {
              await deleteFromR2(segPath, r2Config);
            }
            await supabase.from("gravacoes_segmentos").delete().eq("id", seg.id);
            cleanupCount++;
          }

          await supabase.from("audit_logs").insert({
            user_id: session.user_id,
            action_type: "segments_cleanup_done",
            success: true,
            details: { session_id: session.id, count: cleanupCount },
          });

          // ── Fire-and-forget: trigger process-recording ──
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          fetch(`${supabaseUrl}/functions/v1/process-recording`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ gravacao_id: gravacao.id }),
          }).catch((e) => console.error("process-recording trigger error:", e));

          results.push({
            action: "concatenated",
            session_id: session.id,
            gravacao_id: gravacao.id,
            segments: segments.length,
            duration: totalDuration,
          });
        } catch (sessionErr) {
          console.error(`Error processing session ${session.id}:`, sessionErr);
          await supabase.from("audit_logs").insert({
            user_id: session.user_id,
            action_type: "session_maintenance_error",
            success: false,
            details: { session_id: session.id, error: String(sessionErr) },
          });
          results.push({ action: "error", session_id: session.id, error: String(sessionErr) });
        }
      }
    }

    return jsonResponse({
      success: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("session-maintenance error:", err);
    return jsonResponse({ success: false, error: "Erro interno" }, 500);
  }
});
