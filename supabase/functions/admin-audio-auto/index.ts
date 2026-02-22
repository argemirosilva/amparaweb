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
  return `Você atuará como um 'Especialista em Análise Contextual de Relações Conjugais', com foco na proteção da mulher.

PRINCÍPIO: Na dúvida, proteja a mulher. Diferencie conflitos normais de abuso real. Detecte TÁTICAS MANIPULATIVAS SUTIS.

TÁTICAS a detectar: instrumentalizacao_filhos, falsa_demonstracao_afeto, ameaca_juridica_velada, acusacao_sem_evidencia, gaslighting, vitimizacao_reversa, controle_disfarçado_preocupacao.

Retorne APENAS JSON válido:
{"resumo_contexto":"...","analise_linguagem":[],"padroes_detectados":[],"tipos_violencia":[],"nivel_risco":"sem_risco|moderado|alto|critico","justificativa_risco":"...","classificacao_contexto":"saudavel|rispido_nao_abusivo|potencial_abuso_leve|padrao_consistente_abuso|ameaca_risco|risco_elevado_escalada","sentimento":"positivo|negativo|neutro|misto","palavras_chave":[],"xingamentos":[],"categorias":[],"taticas_manipulativas":[{"tatica":"...","descricao":"...","evidencia":"...","gravidade":"baixa|media|alta"}],"orientacoes_vitima":["orientações práticas e acolhedoras"],"sinais_alerta":["sinais identificados"]}
Arrays vazios se não aplicável. Cite evidências da transcrição.`;
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
              xingamentos: parsed.xingamentos || [],
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

      // ── SEED USERS ──
      case "seedUsers": {
        const count = body.count || 100;

        const CIDADES = [
          { cidade: "Manaus", uf: "AM", lat: -3.119, lon: -60.021 },
          { cidade: "Belém", uf: "PA", lat: -1.455, lon: -48.502 },
          { cidade: "Macapá", uf: "AP", lat: 0.034, lon: -51.066 },
          { cidade: "Palmas", uf: "TO", lat: -10.184, lon: -48.333 },
          { cidade: "São Luís", uf: "MA", lat: -2.530, lon: -44.282 },
          { cidade: "Teresina", uf: "PI", lat: -5.089, lon: -42.801 },
          { cidade: "Fortaleza", uf: "CE", lat: -3.717, lon: -38.543 },
          { cidade: "Natal", uf: "RN", lat: -5.795, lon: -35.209 },
          { cidade: "João Pessoa", uf: "PB", lat: -7.120, lon: -34.845 },
          { cidade: "Recife", uf: "PE", lat: -8.054, lon: -34.871 },
          { cidade: "Maceió", uf: "AL", lat: -9.665, lon: -35.735 },
          { cidade: "Aracaju", uf: "SE", lat: -10.911, lon: -37.071 },
          { cidade: "Salvador", uf: "BA", lat: -12.971, lon: -38.510 },
          { cidade: "Vitória da Conquista", uf: "BA", lat: -14.861, lon: -40.844 },
          { cidade: "Belo Horizonte", uf: "MG", lat: -19.917, lon: -43.934 },
          { cidade: "Uberlândia", uf: "MG", lat: -18.918, lon: -48.275 },
          { cidade: "Juiz de Fora", uf: "MG", lat: -21.764, lon: -43.349 },
          { cidade: "Vitória", uf: "ES", lat: -20.319, lon: -40.337 },
          { cidade: "Rio de Janeiro", uf: "RJ", lat: -22.906, lon: -43.172 },
          { cidade: "Niterói", uf: "RJ", lat: -22.883, lon: -43.103 },
          { cidade: "São Paulo", uf: "SP", lat: -23.550, lon: -46.633 },
          { cidade: "Campinas", uf: "SP", lat: -22.905, lon: -47.060 },
          { cidade: "Sorocaba", uf: "SP", lat: -23.501, lon: -47.458 },
          { cidade: "Ribeirão Preto", uf: "SP", lat: -21.177, lon: -47.810 },
          { cidade: "Santos", uf: "SP", lat: -23.960, lon: -46.333 },
          { cidade: "Curitiba", uf: "PR", lat: -25.428, lon: -49.273 },
          { cidade: "Londrina", uf: "PR", lat: -23.310, lon: -51.162 },
          { cidade: "Maringá", uf: "PR", lat: -23.420, lon: -51.933 },
          { cidade: "Florianópolis", uf: "SC", lat: -27.594, lon: -48.548 },
          { cidade: "Joinville", uf: "SC", lat: -26.304, lon: -48.845 },
          { cidade: "Porto Alegre", uf: "RS", lat: -30.034, lon: -51.230 },
          { cidade: "Caxias do Sul", uf: "RS", lat: -29.168, lon: -51.179 },
          { cidade: "Campo Grande", uf: "MS", lat: -20.449, lon: -54.620 },
          { cidade: "Cuiabá", uf: "MT", lat: -15.601, lon: -56.097 },
          { cidade: "Goiânia", uf: "GO", lat: -16.686, lon: -49.264 },
          { cidade: "Brasília", uf: "DF", lat: -15.793, lon: -47.882 },
          { cidade: "Porto Velho", uf: "RO", lat: -8.760, lon: -63.900 },
          { cidade: "Rio Branco", uf: "AC", lat: -9.974, lon: -67.810 },
          { cidade: "Boa Vista", uf: "RR", lat: 2.819, lon: -60.673 },
          { cidade: "Imperatriz", uf: "MA", lat: -5.518, lon: -47.474 },
          { cidade: "Petrolina", uf: "PE", lat: -9.389, lon: -40.502 },
          { cidade: "Caruaru", uf: "PE", lat: -8.282, lon: -35.976 },
          { cidade: "Feira de Santana", uf: "BA", lat: -12.266, lon: -38.966 },
          { cidade: "Montes Claros", uf: "MG", lat: -16.735, lon: -43.861 },
          { cidade: "Pelotas", uf: "RS", lat: -31.771, lon: -52.342 },
          { cidade: "Chapecó", uf: "SC", lat: -27.100, lon: -52.615 },
          { cidade: "Cascavel", uf: "PR", lat: -24.955, lon: -53.455 },
          { cidade: "Piracicaba", uf: "SP", lat: -22.725, lon: -47.649 },
          { cidade: "Bauru", uf: "SP", lat: -22.314, lon: -49.060 },
          { cidade: "Volta Redonda", uf: "RJ", lat: -22.523, lon: -44.104 },
        ];

        const NOMES = [
          "Ana", "Maria", "Julia", "Beatriz", "Larissa", "Fernanda", "Camila", "Patrícia",
          "Luciana", "Tatiane", "Vanessa", "Renata", "Débora", "Priscila", "Adriana",
          "Simone", "Jéssica", "Aline", "Raquel", "Luana", "Sabrina", "Carla", "Cláudia",
          "Mariana", "Letícia", "Viviane", "Natália", "Michele", "Elaine", "Cristiane",
          "Gabriela", "Daniela", "Caroline", "Isabela", "Thaís", "Bruna", "Amanda",
          "Rafaela", "Érica", "Sandra", "Rosana", "Mônica", "Valéria", "Sônia", "Marta",
          "Helena", "Tereza", "Francisca", "Antônia", "Joana", "Célia", "Regina", "Márcia",
          "Aparecida", "Vera", "Rosa", "Fátima", "Lúcia", "Solange", "Neide",
        ];

        const SOBRENOMES = [
          "Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Ferreira",
          "Almeida", "Rodrigues", "Nascimento", "Araújo", "Ribeiro", "Carvalho", "Gomes",
          "Martins", "Barbosa", "Rocha", "Moreira", "Correia", "Melo", "Cardoso", "Dias",
          "Teixeira", "Mendes", "Vieira", "Nunes", "Monteiro", "Pinto", "Batista",
          "Duarte", "Moura", "Lopes", "Freitas", "Ramos", "Campos", "Reis", "Azevedo",
        ];

        const BAIRROS = [
          "Centro", "Jardim América", "Vila Nova", "São José", "Santa Maria", "Boa Vista",
          "Liberdade", "Consolação", "Parque Industrial", "Vila Mariana", "Bela Vista",
          "Jardim das Flores", "Alto da Boa Vista", "Vila Progresso", "São Francisco",
          "Nova Esperança", "Jardim Primavera", "Santa Lúcia", "Vila Rica", "Monte Castelo",
        ];

        const ESCOLARIDADES = [
          "Ensino Fundamental Incompleto", "Ensino Fundamental Completo",
          "Ensino Médio Incompleto", "Ensino Médio Completo",
          "Ensino Superior Incompleto", "Ensino Superior Completo",
          "Pós-Graduação",
        ];

        const COR_RACA = ["Branca", "Preta", "Parda", "Amarela", "Indígena"];

        const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
        const randBetween = (a: number, b: number) => a + Math.random() * (b - a);

        const dummyHash = "$2b$10$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

        const users: any[] = [];
        for (let i = 0; i < count; i++) {
          const nome = pick(NOMES);
          const sobrenome1 = pick(SOBRENOMES);
          const sobrenome2 = pick(SOBRENOMES);
          const nomeCompleto = `${nome} ${sobrenome1} ${sobrenome2}`;
          const cidade = pick(CIDADES);
          const suffix = `${i + 1}`.padStart(3, "0");
          const email = `${nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}.${sobrenome1.toLowerCase()}.seed${suffix}@ficticio.com`;

          const nascAno = 1970 + Math.floor(Math.random() * 35); // 1970-2004
          const nascMes = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
          const nascDia = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");

          const ddd = String(11 + Math.floor(Math.random() * 88)).padStart(2, "0");
          const tel = `(${ddd}) 9${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

          const cep = `${String(10000 + Math.floor(Math.random() * 89999)).padStart(5, "0")}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

          // Random date within last 6 months for created_at
          const createdAt = new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString();

          users.push({
            nome_completo: nomeCompleto,
            email,
            telefone: tel,
            senha_hash: dummyHash,
            status: "ativo",
            email_verificado: true,
            onboarding_completo: true,
            data_nascimento: `${nascAno}-${nascMes}-${nascDia}`,
            cor_raca: pick(COR_RACA),
            escolaridade: pick(ESCOLARIDADES),
            endereco_cidade: cidade.cidade,
            endereco_uf: cidade.uf,
            endereco_bairro: pick(BAIRROS),
            endereco_cep: cep,
            endereco_lat: cidade.lat + randBetween(-0.05, 0.05),
            endereco_lon: cidade.lon + randBetween(-0.05, 0.05),
            mora_com_agressor: Math.random() < 0.35,
            tem_filhos: Math.random() < 0.5,
            compartilhar_gps_panico: true,
            compartilhar_gps_risco_alto: Math.random() < 0.6,
            created_at: createdAt,
          });
        }

        // Insert in batches of 50
        let inserted = 0;
        const errors: string[] = [];
        for (let i = 0; i < users.length; i += 50) {
          const batch = users.slice(i, i + 50);
          const { error: insErr, data: insData } = await supabase
            .from("usuarios")
            .insert(batch)
            .select("id");
          if (insErr) {
            errors.push(`Batch ${i}: ${insErr.message}`);
          } else {
            inserted += insData.length;
          }
        }

        return json({ ok: true, inserted, total_requested: count, errors: errors.length > 0 ? errors : undefined });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return json({ error: msg }, 500);
  }
});
