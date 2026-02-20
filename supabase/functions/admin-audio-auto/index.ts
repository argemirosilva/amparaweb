import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashToken(token: string) {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function authenticateAdmin(supabase: any, sessionToken: string) {
  const tokenHash = await hashToken(sessionToken);
  const { data: session } = await supabase
    .from("user_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (
    !session ||
    session.revoked_at ||
    new Date(session.expires_at) < new Date()
  )
    return null;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id);

  const isAdmin = (roles || []).some(
    (r: any) => r.role === "admin_master" || r.role === "admin_tenant"
  );
  return isAdmin ? session.user_id : null;
}

// ── Script Generation via Lovable AI Gateway ──

const TOPICS = [
  "ciúmes e controle do celular",
  "controle financeiro e dinheiro",
  "isolamento de amigos e família",
  "humilhação verbal e gaslighting",
  "ameaça velada sobre custódia dos filhos",
  "controle sobre roupas e aparência",
  "cobrança excessiva sobre trabalho",
  "ciclo lua de mel pós-conflito",
  "manipulação emocional",
  "desqualificação profissional",
  "pressão sobre tarefas domésticas",
  "intimidação sem violência física",
  "chantagem emocional",
  "controle de horários e rotina",
  "minimização dos sentimentos da parceira",
  "vigilância constante e desconfiança",
  "uso dos filhos como instrumento de controle",
  "ameaça de expulsão de casa",
  "depreciação da família da parceira",
  "controle sobre alimentação e saúde",
];

async function generateScript(targetDurationHint: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

  const prompt = `Gere um roteiro de diálogo realista em português brasileiro entre um casal (M = homem agressor, F = mulher vítima) sobre o tema: "${topic}".

REGRAS OBRIGATÓRIAS:
- O roteiro deve ter ${targetDurationHint} turnos de fala para resultar em áudio de 1 a 5 minutos.
- Estrutura narrativa: início aparentemente neutro → escalada gradual → controle/ameaça velada → minimização → tentativa de reconciliação falsa.
- Linguagem natural coloquial brasileira com gírias e expressões regionais variadas.
- SEM violência física explícita. Foco em abuso psicológico, controle coercitivo, manipulação.
- Cada fala deve ter entre 5 e 35 palavras.
- O diálogo deve ser realista para treinar sistemas de detecção de violência doméstica.
- Inclua falas sobrepostas e interrupções (marcadas com "..." no final).
- Varie o tom: algumas falas calmas, outras exaltadas, algumas sussurradas.

Responda EXCLUSIVAMENTE com JSON válido (sem markdown, sem texto extra):
{"topic":"${topic}","turns":[{"speaker":"M","text":"..."},{"speaker":"F","text":"..."}]}`;

  const res = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.95,
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI Gateway error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON script");

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.turns || !Array.isArray(parsed.turns) || parsed.turns.length < 5)
    throw new Error("Script has too few turns");

  return { ...parsed, topic };
}

// ── TTS via ElevenLabs ──

const MALE_VOICE = "onwK4e9ZLuTAKqWW03F9"; // Daniel
const FEMALE_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah

async function generateTTS(
  text: string,
  speaker: string
): Promise<Uint8Array> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
  const voiceId = speaker === "M" ? MALE_VOICE : FEMALE_VOICE;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.35,
          speed: 1.0,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${errText}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}

// ── Audio Utilities ──

function concatenateBuffers(segments: Uint8Array[]): Uint8Array {
  const totalLength = segments.reduce((acc, s) => acc + s.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const seg of segments) {
    result.set(seg, offset);
    offset += seg.length;
  }
  return result;
}

function estimateDurationSec(mp3Bytes: number): number {
  // 128kbps = 16000 bytes/sec
  return Math.round(mp3Bytes / 16000);
}

// ── Process a Single Item ──

async function processItem(
  supabase: any,
  item: any,
  jobId: string,
  targetUserId: string
): Promise<{ success: boolean; topic?: string; duration?: number; error?: string }> {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await supabase
        .from("audio_generation_items")
        .update({
          status: "processing",
          tries: attempt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // 1) Determine target length hint based on previous attempt results
      let turnsHint = "entre 25 e 40";
      if (attempt === 2) turnsHint = "entre 35 e 50";
      if (attempt === 3) turnsHint = "entre 30 e 45";

      // 2) Generate script
      const script = await generateScript(turnsHint);

      await supabase
        .from("audio_generation_items")
        .update({
          script,
          topic: script.topic,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // 3) Generate TTS segments in parallel batches of 5
      const turns: { speaker: string; text: string }[] = script.turns;
      const segments: Uint8Array[] = [];
      const BATCH = 5;

      for (let i = 0; i < turns.length; i += BATCH) {
        const batch = turns.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map((t) => generateTTS(t.text, t.speaker))
        );
        segments.push(...results);
      }

      // 4) Concatenate
      const finalMp3 = concatenateBuffers(segments);
      const durationSec = estimateDurationSec(finalMp3.length);

      // 5) Duration check
      if (durationSec < 60 && attempt < MAX_ATTEMPTS) continue;
      if (durationSec > 300 && attempt < MAX_ATTEMPTS) continue;

      // 6) Upload MP3 to storage
      const storagePath = `autogerado/${jobId}/${item.item_index}/mix.mp3`;
      const { error: upErr } = await supabase.storage
        .from("audio-recordings")
        .upload(storagePath, finalMp3, {
          contentType: "audio/mpeg",
          upsert: true,
        });
      if (upErr) throw new Error(`Upload MP3: ${upErr.message}`);

      // 7) Upload script JSON
      const scriptPath = `autogerado/${jobId}/${item.item_index}/script.json`;
      await supabase.storage
        .from("audio-recordings")
        .upload(scriptPath, JSON.stringify(script, null, 2), {
          contentType: "application/json",
          upsert: true,
        });

      // 8) Build transcription
      const transcricao = turns
        .map((t) => `[${t.speaker === "M" ? "Ele" : "Ela"}] ${t.text}`)
        .join("\n");

      // 9) Insert into gravacoes
      const { data: gravacao, error: gravErr } = await supabase
        .from("gravacoes")
        .insert({
          user_id: targetUserId,
          status: "processado",
          storage_path: storagePath,
          duracao_segundos: durationSec,
          tamanho_mb:
            Math.round((finalMp3.length / 1024 / 1024) * 100) / 100,
          device_id: "admin_autogerado",
          transcricao,
        })
        .select("id")
        .single();

      if (gravErr) throw new Error(`Gravacoes insert: ${gravErr.message}`);

      // 10) Update item as done
      await supabase
        .from("audio_generation_items")
        .update({
          status: "done",
          duration_sec: durationSec,
          storage_url: storagePath,
          gravacao_id: gravacao.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // 11) Increment job done_count
      const { data: job } = await supabase
        .from("audio_generation_jobs")
        .select("done_count")
        .eq("id", jobId)
        .single();

      await supabase
        .from("audio_generation_jobs")
        .update({
          done_count: (job?.done_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return { success: true, topic: script.topic, duration: durationSec };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      if (attempt === MAX_ATTEMPTS) {
        await supabase
          .from("audio_generation_items")
          .update({
            status: "failed",
            last_error: errMsg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        const { data: job } = await supabase
          .from("audio_generation_jobs")
          .select("failed_count")
          .eq("id", jobId)
          .single();

        await supabase
          .from("audio_generation_jobs")
          .update({
            failed_count: (job?.failed_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        return { success: false, error: errMsg };
      }
    }
  }

  return { success: false, error: "Max attempts exceeded" };
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const body = await req.json();
    const { action, session_token, job_id } = body;

    const adminUserId = await authenticateAdmin(supabase, session_token);
    if (!adminUserId) return json({ error: "Não autorizado" }, 401);

    const targetUserId = body.target_user_id || adminUserId;

    switch (action) {
      // ── START ──
      case "start": {
        const count = body.count || 100;

        const { data: job, error: jobErr } = await supabase
          .from("audio_generation_jobs")
          .insert({
            status: "processing",
            total: count,
            created_by: adminUserId,
            settings: {
              male_voice: MALE_VOICE,
              female_voice: FEMALE_VOICE,
              model: "eleven_multilingual_v2",
            },
          })
          .select("id")
          .single();

        if (jobErr) return json({ error: jobErr.message }, 500);

        const items = Array.from({ length: count }, (_, i) => ({
          job_id: job.id,
          item_index: i + 1,
          status: "queued",
        }));

        const { error: itemsErr } = await supabase
          .from("audio_generation_items")
          .insert(items);

        if (itemsErr) return json({ error: itemsErr.message }, 500);

        return json({ ok: true, job_id: job.id });
      }

      // ── PROCESS NEXT ──
      case "processNext": {
        if (!job_id) return json({ error: "job_id required" }, 400);

        const { data: job } = await supabase
          .from("audio_generation_jobs")
          .select("status")
          .eq("id", job_id)
          .single();

        if (!job || job.status === "canceled" || job.status === "done")
          return json({ ok: true, finished: true, status: job?.status });

        const { data: nextItem } = await supabase
          .from("audio_generation_items")
          .select("*")
          .eq("job_id", job_id)
          .eq("status", "queued")
          .order("item_index")
          .limit(1)
          .maybeSingle();

        if (!nextItem) {
          await supabase
            .from("audio_generation_jobs")
            .update({ status: "done", updated_at: new Date().toISOString() })
            .eq("id", job_id);
          return json({ ok: true, finished: true, status: "done" });
        }

        const result = await processItem(
          supabase,
          nextItem,
          job_id,
          targetUserId
        );

        return json({
          ok: true,
          finished: false,
          item_index: nextItem.item_index,
          result,
        });
      }

      // ── GET STATUS ──
      case "getStatus": {
        if (!job_id) return json({ error: "job_id required" }, 400);

        const { data: job } = await supabase
          .from("audio_generation_jobs")
          .select("*")
          .eq("id", job_id)
          .single();

        const { data: items } = await supabase
          .from("audio_generation_items")
          .select(
            "id, item_index, status, topic, duration_sec, tries, last_error, storage_url"
          )
          .eq("job_id", job_id)
          .order("item_index");

        return json({ ok: true, job, items });
      }

      // ── CANCEL ──
      case "cancel": {
        if (!job_id) return json({ error: "job_id required" }, 400);

        await supabase
          .from("audio_generation_jobs")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job_id);

        await supabase
          .from("audio_generation_items")
          .update({
            status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", job_id)
          .eq("status", "queued");

        return json({ ok: true });
      }

      // ── RETRY FAILED ──
      case "retryFailed": {
        if (!job_id) return json({ error: "job_id required" }, 400);

        const { count } = await supabase
          .from("audio_generation_items")
          .update({
            status: "queued",
            tries: 0,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("job_id", job_id)
          .eq("status", "failed")
          .select("id", { count: "exact", head: true });

        await supabase
          .from("audio_generation_jobs")
          .update({
            status: "processing",
            failed_count: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job_id);

        return json({ ok: true, retried: count || 0 });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
