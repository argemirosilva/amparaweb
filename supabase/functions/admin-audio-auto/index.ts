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

// ── Default Analysis Prompt ──

function getDefaultAnalysisPrompt(): string {
  return `Você atuará como um 'Especialista em Análise Contextual de Violência Doméstica'.
Analise a transcrição e retorne APENAS JSON válido com:
{"resumo_contexto":"...","analise_linguagem":[],"padroes_detectados":[],"tipos_violencia":[],"nivel_risco":"sem_risco|moderado|alto|critico","justificativa_risco":"...","classificacao_contexto":"...","sentimento":"positivo|negativo|neutro|misto","palavras_chave":[],"categorias":[]}`;
}

// ── Script Generation via Lovable AI Gateway ──

const TOPICS_VIOLENCIA = [
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
  "proibição de estudar ou trabalhar fora",
  "humilhação na frente de outras pessoas",
  "comparação com ex-namoradas ou outras mulheres",
  "cobranças sobre maternidade e cuidados com filhos",
  "ameaça de suicídio para manipular",
  "destruição de objetos pessoais",
  "controle do carro e transporte",
  "invasão de privacidade — diário, e-mails, redes sociais",
  "ridicularização de sonhos e ambições",
  "silêncio punitivo e tratamento de gelo",
  "culpabilização da vítima por tudo que dá errado",
  "ameaça de revelar segredos íntimos",
  "controle religioso ou espiritual",
  "pressão sexual e coerção",
  "desqualificação como mãe",
  "ameaça de tirar a casa ou bens",
  "monitoramento por câmeras ou GPS",
  "proibição de usar maquiagem ou se arrumar",
  "acusações constantes de traição sem motivo",
  "manipulação financeira — esconder renda ou dívidas",
  "impedir acesso a tratamento médico",
  "forçar reconciliação com presente e promessa vazia",
  "usar dependência financeira como arma",
  "infantilização — tratar como incapaz",
  "ameaça de denúncia falsa",
  "controle sobre amizades no trabalho",
  "ciúmes do sucesso profissional dela",
  "sabotagem de entrevista de emprego",
  "recusa de participar das responsabilidades domésticas",
  "crítica constante à comida que ela prepara",
];

const TOPICS_BRIGA_SAUDAVEL = [
  "divisão de tarefas domésticas",
  "onde passar as férias",
  "gastos e orçamento doméstico",
  "educação dos filhos e regras de casa",
  "visita da sogra ou família",
  "série ou filme pra assistir juntos",
  "quem esqueceu de pagar a conta",
  "bagunça no quarto ou banheiro",
  "horário de chegar em casa",
  "ciúmes bobos de amizades",
  "discussão sobre o jantar",
  "uso excessivo do celular",
  "quem vai levar o filho na escola",
  "compra impulsiva no cartão",
  "reforma ou decoração da casa",
  "divergência sobre planos de fim de semana",
  "reclamação sobre ronco ou hábitos noturnos",
  "escolha do restaurante para sair",
  "estresse do trabalho trazido pra casa",
  "animal de estimação e responsabilidades",
  "quem controla o ar condicionado",
  "desorganização da garagem ou depósito",
  "tempo gasto com videogame ou hobby",
  "esquecer datas importantes",
  "diferença de opinião sobre criar os filhos com ou sem palmada",
  "amigo inconveniente que sempre aparece",
  "volume da TV ou música alta",
  "dieta e alimentação saudável",
  "planos de mudança de cidade ou bairro",
  "reclamação sobre sogro ou sogra intrometida",
  "quem esqueceu de desligar o fogão",
  "disputa pelo controle remoto",
  "diferença de horário de dormir",
  "discussão sobre economizar ou gastar",
  "reclamação sobre roupas espalhadas",
];

// ~15% das gravações de violência: a mulher também extrapola o respeito
const TOPICS_MULHER_EXTRAPOLA = [
  "ela humilha ele na frente dos amigos e ele reage controlando",
  "ela xinga e deprecia ele, mas ele escala para ameaças",
  "ela faz chantagem emocional e ele responde com controle financeiro",
  "discussão mútua agressiva onde ela ofende a masculinidade dele",
  "ela ameaça sair de casa com os filhos e ele responde com intimidação",
  "briga onde ambos se desrespeitam mas ele escala para manipulação",
  "ela faz comparação com ex-namorado e ele reage com ciúmes extremos",
  "ela critica a família dele de forma cruel e ele responde controlando",
  "discussão onde ela também grita e xinga mas ele ameaça veladamante",
  "ela joga objetos e ele escala para intimidação psicológica",
  "ela deprecia o salário dele e ele responde controlando o dinheiro dela",
  "briga onde ela provoca e zomba mas ele reage com silêncio punitivo prolongado",
  "ela ameaça denúncia falsa e ele responde com chantagem sobre custódia",
  "discussão onde ambos falam coisas horríveis mas há assimetria de poder",
  "ela faz escândalo em público e ele depois pune com isolamento em casa",
];

// Duration variation: returns [turnsHint, targetLabel]
function randomDurationHint(): string {
  const roll = Math.random();
  if (roll < 0.15) return "entre 10 e 18"; // ~30-60s — curto
  if (roll < 0.35) return "entre 18 e 28"; // ~1-2min
  if (roll < 0.60) return "entre 28 e 40"; // ~2-3min
  if (roll < 0.80) return "entre 40 e 55"; // ~3-4min
  if (roll < 0.92) return "entre 55 e 70"; // ~4-5min
  return "entre 70 e 90"; // ~5-7min — longo
}

async function generateScript(targetDurationHint: string, audioMode: string = "violencia") {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

  // Determine which topic pool and prompt style to use
  let topic: string;
  let isMulherExtrapola = false;

  if (audioMode === "briga_saudavel") {
    topic = TOPICS_BRIGA_SAUDAVEL[Math.floor(Math.random() * TOPICS_BRIGA_SAUDAVEL.length)];
  } else {
    // ~15% chance of "mulher extrapola" scenario
    if (Math.random() < 0.15) {
      topic = TOPICS_MULHER_EXTRAPOLA[Math.floor(Math.random() * TOPICS_MULHER_EXTRAPOLA.length)];
      isMulherExtrapola = true;
    } else {
      topic = TOPICS_VIOLENCIA[Math.floor(Math.random() * TOPICS_VIOLENCIA.length)];
    }
  }

  let prompt: string;

  if (audioMode === "briga_saudavel") {
    prompt = `Gere um roteiro de diálogo realista em português brasileiro entre um casal (M = homem, F = mulher) sobre o tema: "${topic}".

REGRAS OBRIGATÓRIAS:
- O roteiro deve ter ${targetDurationHint} turnos de fala.
- O casal está tendo uma DISCUSSÃO ACALORADA porém SAUDÁVEL. Eles discordam, ficam irritados, levantam a voz, mas NÃO há:
  * Controle coercitivo, manipulação ou gaslighting
  * Ameaças veladas ou diretas
  * Humilhação, depreciação ou xingamentos graves
  * Intimidação, chantagem emocional ou isolamento
  * Desigualdade de poder — ambos se expressam livremente
- A dinâmica deve mostrar que é uma briga de casal NORMAL:
  * Ambos argumentam com firmeza e defendem seus pontos
  * Há irritação mútua e talvez sarcasmo leve, mas sem crueldade
  * Em algum momento um cede parcialmente ou propõe um meio-termo
  * Pode haver humor involuntário ou uma reconciliação natural no final
  * Expressões como "ai, lá vem você de novo", "tô cansada disso", "você nunca escuta" são aceitáveis
- Linguagem natural coloquial brasileira com gírias e expressões regionais variadas.
- Cada fala deve ter entre 5 e 35 palavras.
- Inclua falas sobrepostas e interrupções (marcadas com "..." no final).
- Varie o tom: algumas falas irritadas, outras resignadas, algumas debochadas.
- O objetivo é treinar um sistema a distinguir brigas normais de violência doméstica.

Responda EXCLUSIVAMENTE com JSON válido (sem markdown, sem texto extra):
{"topic":"${topic}","turns":[{"speaker":"M","text":"..."},{"speaker":"F","text":"..."}]}`;
  } else if (isMulherExtrapola) {
    prompt = `Gere um roteiro de diálogo realista em português brasileiro entre um casal (M = homem, F = mulher) sobre o tema: "${topic}".

REGRAS OBRIGATÓRIAS:
- O roteiro deve ter ${targetDurationHint} turnos de fala.
- CENÁRIO COMPLEXO: a mulher TAMBÉM extrapola o respeito — ela xinga, humilha, provoca ou agride verbalmente.
- PORÉM, o homem ESCALA a situação para um nível mais grave: controle coercitivo, ameaças, manipulação psicológica, intimidação.
- A assimetria de poder deve ficar CLARA: mesmo que ela também erre, ele usa táticas de dominação e controle.
- Isso NÃO é uma briga saudável — é uma relação tóxica onde AMBOS se desrespeitam, mas ele detém mais poder e controle.
- Linguagem natural coloquial brasileira com gírias e expressões regionais variadas.
- Cada fala deve ter entre 5 e 35 palavras.
- Inclua falas sobrepostas e interrupções (marcadas com "..." no final).
- Varie o tom: ela pode ser agressiva/provocadora, ele pode ser frio/calculista ou explosivo.
- O objetivo é treinar o sistema a reconhecer violência MESMO quando a vítima também tem comportamento inadequado.

Responda EXCLUSIVAMENTE com JSON válido (sem markdown, sem texto extra):
{"topic":"${topic}","turns":[{"speaker":"M","text":"..."},{"speaker":"F","text":"..."}]}`;
  } else {
    prompt = `Gere um roteiro de diálogo realista em português brasileiro entre um casal (M = homem agressor, F = mulher vítima) sobre o tema: "${topic}".

REGRAS OBRIGATÓRIAS:
- O roteiro deve ter ${targetDurationHint} turnos de fala.
- Estrutura narrativa: início aparentemente neutro → escalada gradual → controle/ameaça velada → minimização → tentativa de reconciliação falsa.
- Linguagem natural coloquial brasileira com gírias e expressões regionais variadas.
- SEM violência física explícita. Foco em abuso psicológico, controle coercitivo, manipulação.
- Cada fala deve ter entre 5 e 35 palavras.
- O diálogo deve ser realista para treinar sistemas de detecção de violência doméstica.
- Inclua falas sobrepostas e interrupções (marcadas com "..." no final).
- Varie o tom: algumas falas calmas, outras exaltadas, algumas sussurradas.

Responda EXCLUSIVAMENTE com JSON válido (sem markdown, sem texto extra):
{"topic":"${topic}","turns":[{"speaker":"M","text":"..."},{"speaker":"F","text":"..."}]}`;
  }

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

  return { ...parsed, topic, mulher_extrapola: isMulherExtrapola };
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
  targetUserId: string,
  audioMode: string = "violencia"
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

      // 1) Use random duration variation
      const turnsHint = randomDurationHint();

      // 2) Generate script
      const script = await generateScript(turnsHint, audioMode);

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

      // 5) Duration check — relaxed: accept 20s to 7min
      if (durationSec < 20 && attempt < MAX_ATTEMPTS) continue;
      if (durationSec > 420 && attempt < MAX_ATTEMPTS) continue;

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

      // 9) Generate random date within last 12 months
      const now = Date.now();
      const twelveMonthsMs = 365 * 24 * 60 * 60 * 1000;
      const randomTs = new Date(now - Math.random() * twelveMonthsMs);
      // Randomize time with nighttime bias (60% between 19-23h)
      const hourRoll = Math.random();
      if (hourRoll < 0.60) {
        randomTs.setHours(19 + Math.floor(Math.random() * 5)); // 19-23
      } else if (hourRoll < 0.85) {
        randomTs.setHours(12 + Math.floor(Math.random() * 7)); // 12-18
      } else {
        randomTs.setHours(6 + Math.floor(Math.random() * 6)); // 06-11
      }
      randomTs.setMinutes(Math.floor(Math.random() * 60));
      randomTs.setSeconds(Math.floor(Math.random() * 60));
      const randomDate = randomTs.toISOString();

      // 10) Insert into gravacoes with random date
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
          created_at: randomDate,
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
    const audioMode = body.audio_mode || "violencia";

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
            audio_mode: audioMode,
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
          targetUserId,
          audioMode
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

      // ── BATCH ANALYZE (run AI analysis on existing transcriptions) ──
      case "batchAnalyze": {
        // Find auto-generated recordings without analysis
        const { data: unanalyzed } = await supabase
          .from("gravacoes")
          .select("id, user_id, transcricao")
          .eq("device_id", "admin_autogerado")
          .not("transcricao", "is", null)
          .order("created_at");

        if (!unanalyzed || unanalyzed.length === 0) {
          return json({ ok: true, message: "Nenhuma gravação pendente de análise", analyzed: 0 });
        }

        // Filter out those that already have an analysis
        const allIds = unanalyzed.map((g: any) => g.id);
        const { data: existingAnalyses } = await supabase
          .from("gravacoes_analises")
          .select("gravacao_id")
          .in("gravacao_id", allIds);

        const analyzedSet = new Set((existingAnalyses || []).map((a: any) => a.gravacao_id));
        const pending = unanalyzed.filter((g: any) => !analyzedSet.has(g.id));

        if (pending.length === 0) {
          return json({ ok: true, message: "Todas já foram analisadas", analyzed: 0 });
        }

        // Get the analysis prompt
        let systemPrompt: string;
        try {
          const { data: promptData } = await supabase
            .from("admin_settings")
            .select("valor")
            .eq("chave", "ia_prompt_analise")
            .maybeSingle();
          systemPrompt = promptData?.valor?.trim() || getDefaultAnalysisPrompt();
        } catch {
          systemPrompt = getDefaultAnalysisPrompt();
        }

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
        let analyzedCount = 0;
        let errors: string[] = [];

        // Process one at a time to avoid rate limits
        const batchSize = body.batch_size || 5;
        const toProcess = pending.slice(0, batchSize);

        for (const grav of toProcess) {
          try {
            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: `Analise esta transcrição:\n\n${grav.transcricao}` },
                ],
              }),
            });

            if (!aiRes.ok) {
              const errText = await aiRes.text();
              errors.push(`${grav.id}: AI ${aiRes.status}`);
              continue;
            }

            const aiData = await aiRes.json();
            const raw = aiData.choices?.[0]?.message?.content || "";

            let cleanJson = raw.trim();
            if (cleanJson.startsWith("```")) {
              cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
            }

            let parsed: any;
            try {
              const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
              parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleanJson);
            } catch {
              parsed = { resumo_contexto: raw.substring(0, 500), nivel_risco: "moderado", sentimento: "neutro", categorias: [], palavras_chave: [] };
            }

            await supabase.from("gravacoes_analises").insert({
              gravacao_id: grav.id,
              user_id: grav.user_id,
              resumo: parsed.resumo_contexto || parsed.resumo || "",
              sentimento: parsed.sentimento || "neutro",
              nivel_risco: parsed.nivel_risco || "sem_risco",
              categorias: parsed.categorias || [],
              palavras_chave: parsed.palavras_chave || [],
              analise_completa: parsed,
              modelo_usado: "google/gemini-3-flash-preview",
            });

            analyzedCount++;
          } catch (e) {
            errors.push(`${grav.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        return json({
          ok: true,
          analyzed: analyzedCount,
          remaining: pending.length - analyzedCount,
          errors: errors.length > 0 ? errors : undefined,
        });
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
