import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronDown, Copy, Check, Rocket, GitBranch, AlertTriangle, Lightbulb } from "lucide-react";

const BASE_URL = "https://uogenwcycqykfsuongrl.supabase.co/functions/v1/mobile-api";
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2Vud2N5Y3F5a2ZzdW9uZ3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjg2NjIsImV4cCI6MjA4NjQwNDY2Mn0.hncTs6DDS-sbb8sT_QBOBf1mTcTu0e_Pc5yXo4tHZwE";

interface Endpoint {
  action: string;
  fase: number;
  description: string;
  auth: "session_token" | "email_usuario" | "refresh_token" | "nenhuma" | "session_token ou email_usuario";
  params: { name: string; type: string; required: boolean; description: string }[];
  response: Record<string, unknown>;
  aliases?: string[];
  notes?: string[];
  usageGuide?: string;
}

const ENDPOINTS: Endpoint[] = [
  // ── Fase 1: Autenticação & Sincronização ──
  {
    action: "loginCustomizado",
    fase: 1,
    description: "Autentica a usuária e retorna access_token + refresh_token. Detecta senha de coação silenciosamente. Rate limit: 5 tentativas / 15 min por email+IP.",
    auth: "nenhuma",
    usageGuide: "Primeira chamada do app ao iniciar. Armazene o session_token de forma segura (SharedPreferences criptografadas no Android / Keychain no iOS). O refresh_token deve ser guardado separadamente para renovação automática. Se loginTipo retornar 'coacao', o app DEVE se comportar de forma idêntica ao login normal - nenhuma mudança visual, nenhuma mensagem diferente. O backend já registra o evento no audit log. Após login bem-sucedido, a próxima chamada obrigatória é syncConfigMobile.",
    params: [
      { name: "email", type: "string", required: true, description: "Email da usuária" },
      { name: "senha", type: "string", required: true, description: "Senha da usuária" },
      { name: "tipo_acao", type: "string", required: false, description: "Ex: 'desinstalacao' para registrar evento no audit" },
    ],
    response: {
      success: true,
      usuario: { id: "uuid", email: "...", nome_completo: "...", telefone: "...", tipo_interesse: "..." },
      loginTipo: "normal | coacao",
      session: { token: "access_token_hex_128chars", expires_at: "ISO8601" },
      refresh_token: "refresh_token_hex_128chars",
    },
  },
  {
    action: "refresh_token",
    fase: 1,
    description: "Renova o access_token usando um refresh_token válido. O refresh_token anterior é revogado (rotação).",
    auth: "refresh_token",
    usageGuide: "Chame esta action ANTES que o session_token expire (verifique o campo expires_at retornado no login). Recomendação: renovar quando faltar 5 minutos para expirar. Após a chamada, AMBOS os tokens (access e refresh) são substituídos - descarte os antigos imediatamente. Se o refresh_token já tiver sido usado (rotação), a chamada falha e o usuário precisa refazer login.",
    params: [
      { name: "refresh_token", type: "string", required: true, description: "Refresh token de 128 caracteres" },
    ],
    response: {
      success: true,
      access_token: "novo_access_token",
      refresh_token: "novo_refresh_token",
      user: { id: "uuid", email: "...", nome_completo: "..." },
    },
  },
  {
    action: "pingMobile",
    fase: 1,
    description: "Heartbeat do dispositivo (1s normal / 1s pânico). Atualiza status de bateria, gravação, monitoramento. Se latitude/longitude estiverem presentes, registra localização automaticamente (vincula a alerta de pânico ativo se existir). Device único por usuária - novo device_id substitui o anterior. O frontend aplica snap-to-road (Mapbox Map Matching API) para exibir o marcador na via mais próxima. ⚠️ Deduplicação GPS: se timestamp_gps já existir para a usuária, o registro é ignorado silenciosamente.",
    auth: "session_token",
    usageGuide: "Deve ser chamado CONTINUAMENTE em background via serviço nativo (AlarmManager/WorkManager no Android, BGTaskScheduler no iOS). Envie TODOS os campos disponíveis - bateria, GPS, status de gravação, status de monitoramento. O backend usa esses dados para determinar se o dispositivo está online (timeout de 30s sem ping = offline). Mesmo que o GPS não esteja disponível, envie o ping sem coordenadas - o status do dispositivo ainda será atualizado. Nunca pause o ping durante gravação ou monitoramento.",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "device_id", type: "string", required: false, description: "Identificador único do dispositivo" },
      { name: "bateria_percentual", type: "number", required: false, description: "Nível da bateria (0-100)" },
      { name: "is_charging", type: "boolean", required: false, description: "Se está carregando" },
      { name: "is_recording", type: "boolean", required: false, description: "Se está gravando" },
      { name: "is_monitoring", type: "boolean", required: false, description: "Se está monitorando" },
      { name: "dispositivo_info", type: "string", required: false, description: "Ex: 'Samsung Galaxy S21'. Identificação do modelo do dispositivo." },
      { name: "device_model", type: "string", required: false, description: "Alias de dispositivo_info. Aceito como fallback caso dispositivo_info não seja enviado." },
      { name: "versao_app", type: "string", required: false, description: "Versão do app. Ex: '1.2.3'" },
      { name: "timezone", type: "string", required: false, description: "Ex: 'America/Sao_Paulo'" },
      { name: "timezone_offset_minutes", type: "number", required: false, description: "Offset em minutos. Ex: -180" },
      { name: "latitude", type: "number", required: false, description: "Latitude GPS (se presente, registra localização)" },
      { name: "longitude", type: "number", required: false, description: "Longitude GPS (se presente, registra localização)" },
      { name: "location_accuracy", type: "number", required: false, description: "Precisão GPS em metros" },
      { name: "location_timestamp", type: "string|number", required: false, description: "Timestamp ISO ou Unix millis do GPS. Usado para deduplicação." },
      { name: "speed", type: "number", required: false, description: "Velocidade m/s" },
      { name: "heading", type: "number", required: false, description: "Direção em graus" },
    ],
    response: { success: true, status: "online", servidor_timestamp: "ISO8601" },
    notes: [
      "device_model é aceito como fallback de dispositivo_info - se ambos forem enviados, dispositivo_info tem prioridade.",
      "GPS com timestamp_gps duplicado é ignorado silenciosamente (deduplicação).",
    ],
  },
  {
    action: "syncConfigMobile",
    fase: 1,
    description: "Sincroniza configurações do servidor para o app. Retorna agendamentos e estado da gravação. Cria sessão de monitoramento automaticamente se dentro de janela agendada.",
    auth: "session_token",
    usageGuide: "Chame imediatamente após o login e depois periodicamente (recomendado: a cada 5-10 minutos ou quando o app volta do background). Esta action é a FONTE ÚNICA DE VERDADE para o estado operacional do app. Se 'dentro_horario' retornar true, o app deve iniciar gravação automática. Se 'sessao_id' for retornado, use-o para vincular os segmentos de áudio. Sempre envie timezone e timezone_offset_minutes para que o backend calcule corretamente os horários de monitoramento.",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "device_id", type: "string", required: false, description: "ID do dispositivo (para criar sessão de monitoramento)" },
      { name: "timezone", type: "string", required: false, description: "Timezone do cliente. Ex: 'America/Sao_Paulo'" },
      { name: "timezone_offset_minutes", type: "number", required: false, description: "Offset em minutos. Ex: -180" },
    ],
    response: {
      success: true,
      gravacao_ativa: false,
      gravacao_ativa_config: true,
      dentro_horario: false,
      periodo_atual_index: null,
      gravacao_inicio: null,
      gravacao_fim: null,
      periodos_hoje: [{ inicio: "17:00", fim: "20:00" }],
      sessao_id: null,
      dias_gravacao: ["Segunda", "Terça"],
      usuario: { id: "uuid", email: "...", nome_completo: "...", telefone: "...", tipo_interesse: "...", status: "ativo" },
      monitoramento: { ativo: false, sessao_id: null, periodos_semana: { seg: [{ inicio: "20:00", fim: "23:00" }] } },
      servidor_timestamp: "ISO8601",
    },
  },

  // ── Fase 2: Sessão & Configuração ──
  {
    action: "logoutMobile",
    fase: 2,
    description: "Encerra a sessão do dispositivo. Bloqueia logout se houver pânico ativo (retorna 403 PANIC_ACTIVE_CANNOT_LOGOUT).",
    auth: "session_token",
    usageGuide: "Chame ao usuário tocar em 'Sair' no app. IMPORTANTE: se houver pânico ativo, o backend retorna erro 403 com código PANIC_ACTIVE_CANNOT_LOGOUT - o app deve exibir mensagem informando que é necessário cancelar o pânico antes de sair. Após logout bem-sucedido, descarte TODOS os tokens locais (session_token e refresh_token). Também limpe qualquer cache de configuração.",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "device_id", type: "string", required: true, description: "ID do dispositivo" },
    ],
    response: { success: true, message: "Logout realizado com sucesso" },
  },
  {
    action: "validate_password",
    fase: 2,
    description: "Valida a senha da usuária e retorna se é normal ou de coação. Rate limit: 5 tentativas / 15 min.",
    auth: "session_token",
    usageGuide: "Use antes de operações sensíveis (alterar senha, excluir conta, etc.) como confirmação de identidade. O retorno 'loginTipo' indica se a senha fornecida é a normal ou a de coação. Se for coação, o app deve se comportar normalmente - a validação retorna success mas o backend registra o evento.",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "senha", type: "string", required: true, description: "Senha a validar" },
    ],
    response: { success: true, loginTipo: "normal | coacao" },
  },
  {
    action: "change_password",
    fase: 2,
    description: "Altera a senha principal. Se a senha atual for a de coação, retorna success: true mas NÃO altera nada (anti-coerção). Rate limit: 5/15min.",
    auth: "session_token",
    usageGuide: "Solicite a senha atual e a nova senha ao usuário. Se a usuária estiver logada com senha de coação, o backend retorna success: true mas NÃO altera a senha real - isso é o mecanismo anti-coerção. O app NUNCA deve diferenciar visualmente essa situação. A nova senha deve ter mínimo 6 caracteres.",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "senha_atual", type: "string", required: true, description: "Senha atual" },
      { name: "nova_senha", type: "string", required: true, description: "Nova senha (mín. 6 caracteres)" },
    ],
    response: { success: true, message: "Senha alterada com sucesso" },
  },
  {
    action: "change_coercion_password",
    fase: 2,
    description: "Altera a senha de coação (segurança). Requer autenticação com senha NORMAL. Se autenticada com senha de coação, retorna success: true sem alterar (anti-coerção). A senha de coação deve ser diferente da senha principal. Rate limit: 5/15min.",
    auth: "session_token",
    usageGuide: "A senha de coação é uma senha alternativa que, quando usada no login, sinaliza silenciosamente uma situação de coerção. Para definir/alterar, a usuária DEVE estar autenticada com a senha NORMAL (não a de coação). Se autenticada com senha de coação, o backend retorna success mas não altera nada. A nova senha de coação deve ser diferente da senha principal - o backend valida isso.",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "senha_atual", type: "string", required: true, description: "Senha atual (deve ser a normal)" },
      { name: "nova_senha_coacao", type: "string", required: true, description: "Nova senha de coação (mín. 6 caracteres, diferente da principal)" },
    ],
    response: { success: true, message: "Senha de segurança alterada com sucesso" },
  },
  {
    action: "update_schedules",
    fase: 2,
    description: "Atualiza os períodos de monitoramento semanal. Máx 8h/dia. Valida formato HH:MM e que inicio < fim. Dias: seg, ter, qua, qui, sex, sab, dom.",
    auth: "session_token",
    usageGuide: "Envie o objeto completo de periodos_semana - o backend substitui toda a configuração (não é merge). Cada dia aceita múltiplos períodos desde que não excedam 8h totais. Formato obrigatório: HH:MM (24h). O campo inicio deve ser menor que fim (não suporta períodos que cruzam meia-noite). Após atualizar, chame syncConfigMobile para confirmar que o app está sincronizado.",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "periodos_semana", type: "object", required: true, description: "Objeto com dias da semana e períodos { seg: [{inicio: 'HH:MM', fim: 'HH:MM'}], ... }" },
    ],
    response: { success: true, message: "Horários atualizados com sucesso", periodos_atualizados: {} },
  },

  // ── Fase 3: GPS & Pânico ──
  {
    action: "enviarLocalizacaoGPS",
    fase: 3,
    description: "Registra localização GPS. Vincula automaticamente ao alerta de pânico ativo se existir. Validação de device_id quando há pânico/monitoramento ativo. O frontend aplica snap-to-road para encaixar a posição na via mais próxima e auto-follow para centralizar o mapa automaticamente. ⚠️ Deduplicação GPS: se timestamp_gps já existir para a usuária, o registro é ignorado silenciosamente - o app deve garantir timestamps únicos.",
    auth: "email_usuario",
    usageGuide: "Use para envios dedicados de GPS fora do ciclo de ping (ex: rastreamento contínuo em pânico). O pingMobile já registra GPS automaticamente quando latitude/longitude estão presentes, então esta action é complementar. IMPORTANTE: se há pânico ou monitoramento ativo, o device_id é OBRIGATÓRIO - sem ele, o backend retorna erro DEVICE_ID_REQUIRED. Se o device_id não corresponder ao registrado no pânico ativo, retorna DEVICE_MISMATCH. Sempre envie timestamp_gps único para evitar deduplicação.",
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "latitude", type: "number", required: true, description: "Latitude" },
      { name: "longitude", type: "number", required: true, description: "Longitude" },
      { name: "device_id", type: "string", required: false, description: "ID do dispositivo (obrigatório se houver pânico/monitoramento ativo)" },
      { name: "alerta_id", type: "string", required: false, description: "ID do alerta de pânico (requer device_id)" },
      { name: "precisao_metros", type: "number", required: false, description: "Precisão do GPS em metros" },
      { name: "bateria_percentual", type: "number", required: false, description: "Nível da bateria" },
      { name: "speed", type: "number", required: false, description: "Velocidade m/s" },
      { name: "heading", type: "number", required: false, description: "Direção em graus" },
      { name: "timestamp_gps", type: "string", required: false, description: "Timestamp ISO do GPS. Usado para deduplicação - timestamps repetidos são ignorados." },
    ],
    response: { success: true, message: "Localização registrada", alerta_id: "uuid | null", servidor_timestamp: "ISO8601" },
    notes: [
      "Deduplicação: se já existir um registro com o mesmo timestamp_gps para a usuária, a inserção é silenciosamente ignorada (sem erro).",
      "Se há pânico ou monitoramento ativo e device_id não é fornecido, retorna erro DEVICE_ID_REQUIRED.",
      "Se device_id informado não bate com o do pânico ativo, retorna erro DEVICE_MISMATCH.",
    ],
  },
  {
    action: "acionarPanicoMobile",
    fase: 3,
    description: "Aciona o botão de pânico. Gera protocolo único (AMP-YYYYMMDD-XXXXXX). Registra localização se fornecida. Notifica rede de apoio via WhatsApp (fire-and-forget).",
    auth: "email_usuario",
    usageGuide: "Chamada crítica - deve ser enviada IMEDIATAMENTE quando o botão de pânico é pressionado. Envie a localização GPS atual junto (campo latitude/longitude na raiz OU dentro do objeto 'localizacao'). Se o GPS não estiver disponível, envie sem coordenadas - o pânico será ativado mesmo assim. O retorno inclui alerta_id e protocolo - armazene ambos localmente. A partir deste momento, o pingMobile vincula automaticamente cada posição GPS ao alerta ativo. O logout fica BLOQUEADO até o pânico ser cancelado.",
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "device_id", type: "string", required: false, description: "ID do dispositivo" },
      { name: "tipo_acionamento", type: "string", required: false, description: "botao_panico | comando_voz. Default: 'botao_panico'" },
      { name: "latitude", type: "number", required: false, description: "Latitude (pode ser enviada na raiz ou dentro do objeto 'localizacao')" },
      { name: "longitude", type: "number", required: false, description: "Longitude (pode ser enviada na raiz ou dentro do objeto 'localizacao')" },
      { name: "localizacao", type: "object", required: false, description: "Formato alternativo: { latitude: number, longitude: number }. O backend aceita coordenadas tanto da raiz quanto deste objeto." },
    ],
    response: { success: true, alerta_id: "uuid", protocolo: "AMP-YYYYMMDD-XXXXXX", rede_apoio_notificada: true, autoridades_acionadas: true },
    notes: [
      "Coordenadas podem ser enviadas de duas formas: campos latitude/longitude na raiz do payload, OU dentro de um objeto 'localizacao'. O backend prioriza os campos raiz e usa localizacao como fallback.",
    ],
  },
  {
    action: "cancelarPanicoMobile",
    fase: 3,
    description: "Cancela alerta de pânico ativo. Se cancelado em <60s = dentro da janela (autoridades NÃO acionadas). Sela sessão de monitoramento ativa. Desativa compartilhamento GPS vinculado. Notifica rede de apoio que pânico foi resolvido.",
    auth: "email_usuario",
    usageGuide: "Se cancelado nos primeiros 60 segundos, o campo 'cancelado_dentro_janela' retorna true e 'autoridades_acionadas' retorna false - útil para acionamentos acidentais. Após 60s, as autoridades já foram notificadas e o cancelamento apenas encerra o rastreamento. O campo 'tempo_ate_cancelamento_segundos' indica quantos segundos se passaram desde o acionamento. Após cancelar, o logout volta a funcionar normalmente.",
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "tipo_cancelamento", type: "string", required: false, description: "manual | automatico. Default: 'manual'" },
      { name: "motivo_cancelamento", type: "string", required: false, description: "Motivo do cancelamento" },
    ],
    response: {
      success: true,
      message: "Alerta cancelado com sucesso",
      alerta_id: "uuid",
      protocolo: "AMP-...",
      tipo_cancelamento: "manual",
      cancelado_dentro_janela: true,
      tempo_ate_cancelamento_segundos: 30,
      autoridades_acionadas: false,
      guardioes_notificados: true,
      window_selada: true,
      window_id: "uuid | null",
    },
  },

  // ── Fase 4: Áudio & Monitoramento ──
  {
    action: "reportarStatusGravacao",
    fase: 4,
    description: "Reporta mudança de estado da gravação. Finalização condicional: motivo_parada 'botao_manual', 'manual' ou 'parada_panico' sela imediatamente. Outros motivos mantêm sessão ativa para o cron. Gravações com 0 segmentos são descartadas automaticamente.",
    auth: "email_usuario",
    aliases: ["iniciarGravacao", "pararGravacao", "finalizarGravacao"],
    usageGuide: "Chame ao iniciar, pausar, retomar ou finalizar uma gravação. Use status_gravacao='iniciada' quando o microfone começa a captar, e status_gravacao='finalizada' quando parar. O campo total_segmentos é crítico na finalização: se for 0, a sessão é descartada (nenhum áudio foi enviado). O motivo_parada determina o comportamento: 'botao_manual', 'manual' ou 'parada_panico' selam imediatamente; outros motivos (como 'janela_finalizada') mantêm a sessão aberta para o cron de manutenção selar.",
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "device_id", type: "string", required: false, description: "ID do dispositivo" },
      { name: "status_gravacao", type: "string", required: true, description: "iniciada | pausada | retomada | finalizada | enviando | erro" },
      { name: "origem_gravacao", type: "string", required: false, description: "automatico | botao_panico | agendado | comando_voz | botao_manual" },
      { name: "motivo_parada", type: "string", required: false, description: "Motivo da parada. Valores que selam imediatamente: 'botao_manual', 'manual', 'parada_panico'." },
      { name: "total_segmentos", type: "number", required: false, description: "Total de segmentos enviados (0 = descarta sessão)" },
    ],
    response: { success: true, message: "Status da gravação atualizado", sessao_id: "uuid", status: "aguardando_finalizacao | ativa | descartada", servidor_timestamp: "ISO8601" },
    notes: [
      "Os aliases iniciarGravacao, pararGravacao e finalizarGravacao são roteados para o mesmo handler no backend. O app pode usar qualquer um deles com os mesmos parâmetros.",
      "Status 'aguardando_finalizacao': retornado quando motivo_parada é 'botao_manual', 'manual' ou 'parada_panico' - a sessão é selada imediatamente.",
      "Status 'ativa': retornado para outros motivos de parada - a sessão permanece aberta e será selada pelo cron de manutenção.",
      "Status 'descartada': retornado quando total_segmentos === 0 - a sessão é removida do banco.",
    ],
  },
  {
    action: "receberAudioMobile",
    fase: 4,
    description: "Recebe segmento de áudio. Suporta JSON com file_url OU multipart/form-data com upload binário direto para R2. Idempotente via segmento_idx. O backend possui 3 fluxos de resposta: sessão ativa (normal), segmento tardio (grace window 60s), e gravação órfã (sem sessão).",
    auth: "session_token ou email_usuario",
    usageGuide: "Envie cada segmento de 30s assim que gravado - não espere acumular. Use segmento_idx sequencial começando em 1 (1, 2, 3...) para garantir idempotência: se o mesmo idx for enviado novamente na mesma sessão, o backend retorna o segmento existente sem duplicar. Se a sessão de monitoramento foi selada mas o segmento está atrasado, o backend aceita por até 60 segundos (grace window). Após isso, o segmento é salvo como gravação independente (órfã). Prefira multipart/form-data para upload binário direto - evita codificar o áudio em base64.",
    params: [
      { name: "session_token", type: "string", required: false, description: "Token de sessão (alternativa a email_usuario)" },
      { name: "email_usuario", type: "string", required: false, description: "Email da usuária (alternativa a session_token)" },
      { name: "file_url", type: "string", required: false, description: "URL do arquivo (se JSON). Dispensável se multipart com arquivo binário." },
      { name: "device_id", type: "string", required: false, description: "ID do dispositivo" },
      { name: "duracao_segundos", type: "number", required: false, description: "Duração em segundos" },
      { name: "tamanho_mb", type: "number", required: false, description: "Tamanho em MB" },
      { name: "segmento_idx", type: "number", required: false, description: "Índice do segmento, começando em 1 (para idempotência - enviar o mesmo idx na mesma sessão retorna o segmento existente)" },
      { name: "timezone", type: "string", required: false, description: "Timezone" },
      { name: "timezone_offset_minutes", type: "number", required: false, description: "Offset em minutos" },
    ],
    response: { success: true, segmento_id: "uuid", monitor_session_id: "uuid", storage_path: "user_id/date/file.mp4", message: "Segmento de monitoramento salvo." },
    notes: [
      "Fluxo 1 - Sessão ativa: segmento é anexado à sessão de monitoramento ativa. Resposta: { message: 'Segmento de monitoramento salvo.' }",
      "Fluxo 2 - Segmento tardio (Grace Window 60s): se a sessão foi selada há menos de 60 segundos, o segmento é anexado a ela. Resposta: { message: 'Segmento tardio anexado à sessão recém-finalizada.' }",
      "Fluxo 3 - Gravação órfã: sem sessão ativa ou recente, o segmento é salvo como gravação independente e enviado para processamento automático. Resposta: { gravacao_id: 'uuid', message: 'Segmento salvo como gravação independente (sem sessão ativa).' }",
      "Idempotência: se segmento_idx já existe na mesma sessão, retorna o segmento existente sem duplicar.",
    ],
  },
  {
    action: "getAudioSignedUrl",
    fase: 4,
    description: "Gera URL assinada para download de áudio. Verifica propriedade via gravacoes ou gravacoes_segmentos. Expira em 15 minutos (900s).",
    auth: "session_token ou email_usuario",
    usageGuide: "Use quando precisar reproduzir ou baixar um áudio. Prefira enviar file_path (caminho no storage) ao invés de gravacao_id - é mais direto e rápido. A URL gerada expira em 15 minutos (900s). Se expirar, basta chamar novamente para gerar uma nova. O backend verifica que o áudio pertence à usuária autenticada - não é possível acessar áudios de terceiros.",
    params: [
      { name: "session_token", type: "string", required: false, description: "Token de sessão (alternativa a email_usuario)" },
      { name: "email_usuario", type: "string", required: false, description: "Email da usuária (alternativa a session_token)" },
      { name: "file_path", type: "string", required: false, description: "Caminho do arquivo no storage (preferido)" },
      { name: "gravacao_id", type: "string", required: false, description: "ID da gravação (legacy)" },
    ],
    response: { success: true, signed_url: "https://...", gravacao_id: "uuid | null", expires_in_seconds: 900 },
  },
  {
    action: "reprocessarGravacao",
    fase: 4,
    description: "Reenvia gravação para pipeline de processamento (transcrição + análise). Sem autenticação. Reseta status para 'pendente'.",
    auth: "nenhuma",
    usageGuide: "Use para reprocessar gravações que falharam na transcrição ou análise. O status da gravação é resetado para 'pendente' e entra novamente na fila de processamento. Não requer autenticação - útil para ferramentas administrativas. Para uso autenticado (que verifica propriedade), use reprocess_recording.",
    params: [
      { name: "gravacao_id", type: "string", required: true, description: "ID da gravação" },
    ],
    response: { success: true, gravacao_id: "uuid", message: "Gravação enviada para reprocessamento", status: "pendente" },
  },
  {
    action: "reprocess_recording",
    fase: 4,
    description: "Versão autenticada do reprocessamento. Verifica que a gravação pertence ao usuário da sessão.",
    auth: "session_token",
    usageGuide: "Versão segura do reprocessarGravacao - verifica que a gravação pertence à usuária da sessão antes de reprocessar. Use esta versão no app mobile; reserve reprocessarGravacao para painéis administrativos.",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "gravacao_id", type: "string", required: true, description: "ID da gravação" },
    ],
    response: { success: true, gravacao_id: "uuid", message: "Reprocessamento iniciado", status: "pendente" },
  },
  {
    action: "reportarStatusMonitoramento",
    fase: 4,
    description: "Reporta mudança de estado do monitoramento. Atualiza is_monitoring no device_status. Se status for de finalização (janela_finalizada, desativado, erro), sela a sessão ativa.",
    auth: "email_usuario",
    usageGuide: "Chame quando a janela de monitoramento iniciar (status='janela_iniciada') ou finalizar (status='janela_finalizada'). Também use para reportar erros no monitoramento (status='erro'). O device_id é obrigatório. Status de finalização (janela_finalizada, desativado, erro) selam a sessão de monitoramento ativa automaticamente. Envie app_state para ajudar no diagnóstico (ex: 'foreground', 'background', 'killed').",
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "device_id", type: "string", required: true, description: "ID do dispositivo" },
      { name: "status_monitoramento", type: "string", required: true, description: "janela_iniciada | janela_finalizada | ativado | desativado | erro | retomado" },
      { name: "motivo", type: "string", required: false, description: "Motivo da mudança" },
      { name: "app_state", type: "string", required: false, description: "Estado do app (foreground, background, etc)" },
    ],
    response: { success: true, message: "Status de monitoramento atualizado", servidor_timestamp: "ISO8601" },
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
    </Button>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="relative rounded-md bg-muted/50 border border-border">
      {label && <div className="px-3 py-1 border-b border-border text-[10px] font-mono text-muted-foreground uppercase">{label}</div>}
      <div className="flex items-start justify-between p-3">
        <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all flex-1">{code}</pre>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [open, setOpen] = useState(false);

  const exampleBody: Record<string, unknown> = { action: endpoint.action };
  endpoint.params.forEach((p) => {
    if (p.required) {
      if (p.type === "string") exampleBody[p.name] = `<${p.name}>`;
      else if (p.type === "number") exampleBody[p.name] = 0;
      else if (p.type === "boolean") exampleBody[p.name] = false;
      else if (p.type === "object") exampleBody[p.name] = {};
    }
  });

  const authLabel =
    endpoint.auth === "nenhuma"
      ? "Pública"
      : endpoint.auth === "session_token"
      ? "session_token"
      : endpoint.auth === "email_usuario"
      ? "email_usuario"
      : endpoint.auth === "refresh_token"
      ? "refresh_token"
      : "session_token / email_usuario";

  const authColor =
    endpoint.auth === "nenhuma" ? "outline" : "secondary";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Card className="cursor-pointer hover:bg-accent/30 transition-colors">
          <CardContent className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
              <code className="text-sm font-mono font-semibold text-primary">{endpoint.action}</code>
              <Badge variant={authColor} className="text-[10px] shrink-0">{authLabel}</Badge>
              {endpoint.aliases && endpoint.aliases.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  aliases: {endpoint.aliases.map(a => <code key={a} className="text-primary mx-0.5">{a}</code>)}
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
          </CardContent>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-1 pb-4 pt-2 space-y-3">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>

          {/* Usage Guide */}
          {endpoint.usageGuide && (
            <div className="rounded-md bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-primary">Guia de Uso</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{endpoint.usageGuide}</p>
            </div>
          )}

          {/* Aliases info */}
          {endpoint.aliases && endpoint.aliases.length > 0 && (
            <div className="rounded-md bg-primary/10 border border-primary/20 p-3">
              <p className="text-xs font-semibold text-foreground mb-1">🔀 Aliases disponíveis</p>
              <p className="text-xs text-muted-foreground">
                Esta action pode ser chamada usando qualquer um destes nomes: {" "}
                <code className="text-primary">{endpoint.action}</code>
                {endpoint.aliases.map(a => <span key={a}>, <code className="text-primary">{a}</code></span>)}
                . Todos executam o mesmo handler com os mesmos parâmetros.
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Parâmetros</p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Campo</th>
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Obrig.</th>
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.params.map((p) => (
                    <tr key={p.name} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono text-primary">{p.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{p.type}</td>
                      <td className="px-3 py-1.5">{p.required ? "✅" : "-"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Exemplo de Request</p>
            <CodeBlock code={JSON.stringify(exampleBody, null, 2)} label="Body JSON" />
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Exemplo de Response</p>
            <CodeBlock code={JSON.stringify(endpoint.response, null, 2)} label="Response JSON" />
          </div>

          {/* Notes */}
          {endpoint.notes && endpoint.notes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">📝 Notas de implementação</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                {endpoint.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── New Sections ── */

function QuickIntegrationGuide() {
  const steps = [
    { num: 1, action: "loginCustomizado", desc: "Autenticar → obter session_token + refresh_token. Armazenar ambos de forma segura." },
    { num: 2, action: "syncConfigMobile", desc: "Carregar configurações do servidor (agendamentos, estado do monitoramento, dados da usuária)." },
    { num: 3, action: "pingMobile", desc: "Iniciar loop contínuo de heartbeat (1s). Enviar status do dispositivo + GPS a cada ciclo." },
    { num: 4, action: "reportarStatusMonitoramento + receberAudioMobile", desc: "Quando dentro de janela de monitoramento: reportar início, gravar 30s, enviar segmento, repetir." },
    { num: 5, action: "acionarPanicoMobile", desc: "Quando pânico: enviar com localização GPS. O logout fica bloqueado até cancelar." },
  ];

  return (
    <Card>
      <CardContent className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Guia de Integração Rápida</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Ordem mínima de chamadas para o app funcionar corretamente. Cada passo depende do anterior.
        </p>
        <div className="space-y-2">
          {steps.map((s) => (
            <div key={s.num} className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{s.num}</span>
              </div>
              <div className="flex-1 min-w-0">
                <code className="text-xs font-mono font-semibold text-primary">{s.action}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function UsageFlows() {
  return (
    <Card>
      <CardContent className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Fluxos de Uso Completos</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Guias passo a passo para cada cenário crítico do app. Clique para expandir.
        </p>

        <Accordion type="multiple" className="w-full">
          {/* Fluxo A */}
          <AccordionItem value="flow-a">
            <AccordionTrigger className="text-xs font-semibold hover:no-underline">
              Fluxo A - Ciclo de Vida da Sessão (Login até Logout)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-foreground">Passo a passo:</p>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                    <li><code className="text-primary">loginCustomizado</code> com email + senha → receber session_token + refresh_token</li>
                    <li>Armazenar session_token (SharedPreferences criptografadas / Keychain) e refresh_token separadamente</li>
                    <li><code className="text-primary">syncConfigMobile</code> com session_token + timezone → carregar configuração completa</li>
                    <li>Iniciar loop de <code className="text-primary">pingMobile</code> a cada 1 segundo (background service)</li>
                    <li>Monitorar expires_at do token. Quando faltar ~5 min → chamar <code className="text-primary">refresh_token</code></li>
                    <li>Substituir AMBOS os tokens (access e refresh) pelos novos recebidos</li>
                    <li>Para sair: <code className="text-primary">logoutMobile</code> → descartar todos os tokens locais</li>
                  </ol>
                </div>

                <CodeBlock
                  code={JSON.stringify({
                    action: "loginCustomizado",
                    email: "maria@email.com",
                    senha: "minhaSenha123"
                  }, null, 2)}
                  label="1. Login"
                />

                <CodeBlock
                  code={JSON.stringify({
                    action: "syncConfigMobile",
                    session_token: "<token_do_login>",
                    timezone: "America/Sao_Paulo",
                    timezone_offset_minutes: -180
                  }, null, 2)}
                  label="2. Sync Config"
                />

                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                  <p className="text-xs text-destructive font-semibold">⚠️ Atenção</p>
                  <p className="text-xs text-muted-foreground">
                    Se houver pânico ativo, o logout retorna erro 403 com código <code className="text-primary">PANIC_ACTIVE_CANNOT_LOGOUT</code>.
                    A usuária precisa cancelar o pânico primeiro.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Fluxo B */}
          <AccordionItem value="flow-b">
            <AccordionTrigger className="text-xs font-semibold hover:no-underline">
              Fluxo B - Monitoramento Automático (Gravação Agendada)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li><code className="text-primary">syncConfigMobile</code> retorna <code className="text-primary">dentro_horario: true</code> → app inicia gravação</li>
                  <li><code className="text-primary">reportarStatusMonitoramento</code> com status_monitoramento=<code className="text-primary">'janela_iniciada'</code></li>
                  <li><code className="text-primary">reportarStatusGravacao</code> com status_gravacao=<code className="text-primary">'iniciada'</code></li>
                  <li>Loop: gravar 30s → enviar via <code className="text-primary">receberAudioMobile</code> com segmento_idx sequencial (1, 2, 3...)</li>
                  <li>Ao sair da janela: <code className="text-primary">reportarStatusGravacao</code> com status_gravacao=<code className="text-primary">'finalizada'</code> + motivo_parada</li>
                  <li><code className="text-primary">reportarStatusMonitoramento</code> com status_monitoramento=<code className="text-primary">'janela_finalizada'</code></li>
                </ol>

                <CodeBlock
                  code={JSON.stringify({
                    action: "receberAudioMobile",
                    session_token: "<token>",
                    device_id: "device-abc-123",
                    segmento_idx: 1,
                    duracao_segundos: 30,
                    tamanho_mb: 0.45,
                    timezone: "America/Sao_Paulo"
                  }, null, 2)}
                  label="Envio de segmento de áudio"
                />

                <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                  <p className="text-xs font-semibold text-primary">💡 Grace Window (60s)</p>
                  <p className="text-xs text-muted-foreground">
                    Se o app enviar um segmento após a sessão ter sido selada, o backend aceita por até 60 segundos (segmento tardio).
                    Após esse período, o segmento é salvo como gravação independente (órfã).
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Fluxo C */}
          <AccordionItem value="flow-c">
            <AccordionTrigger className="text-xs font-semibold hover:no-underline">
              Fluxo C - Pânico (Acionamento até Resolução)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li><code className="text-primary">acionarPanicoMobile</code> com localização GPS → receber alerta_id + protocolo</li>
                  <li>O <code className="text-primary">pingMobile</code> continua normalmente - cada ping com GPS é automaticamente vinculado ao alerta ativo</li>
                  <li>Opcionalmente: <code className="text-primary">enviarLocalizacaoGPS</code> com alerta_id para rastreamento dedicado adicional</li>
                  <li>Para cancelar: <code className="text-primary">cancelarPanicoMobile</code></li>
                </ol>

                <div className="rounded-md bg-muted/50 border border-border p-2 space-y-1">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Comportamento do cancelamento</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• <strong>{'< 60 segundos:'}</strong> cancelado_dentro_janela=true, autoridades_acionadas=false (acionamento acidental)</p>
                    <p>• <strong>{'> 60 segundos:'}</strong> cancelado_dentro_janela=false, autoridades_acionadas=true (já notificadas)</p>
                  </div>
                </div>

                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                  <p className="text-xs text-destructive font-semibold">⚠️ Logout bloqueado</p>
                  <p className="text-xs text-muted-foreground">
                    Durante pânico ativo, qualquer tentativa de logout retorna 403 <code className="text-primary">PANIC_ACTIVE_CANNOT_LOGOUT</code>.
                    O app deve informar que é necessário cancelar o pânico primeiro.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Fluxo D */}
          <AccordionItem value="flow-d">
            <AccordionTrigger className="text-xs font-semibold hover:no-underline">
              Fluxo D - Gerenciamento de Senhas (Normal + Coação)
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p><strong>Senha principal:</strong> <code className="text-primary">change_password</code> - altera a senha de acesso normal.</p>
                  <p><strong>Senha de coação:</strong> <code className="text-primary">change_coercion_password</code> - define/altera a senha que sinaliza coerção silenciosamente.</p>
                  <p><strong>Validação:</strong> <code className="text-primary">validate_password</code> - confirma identidade antes de operações sensíveis.</p>
                </div>

                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-xs text-destructive font-semibold">🔒 Comportamento Anti-Coerção (CRÍTICO)</p>
                  <div className="text-xs text-muted-foreground space-y-1 mt-1">
                    <p>Quando a usuária está logada com a <strong>senha de coação</strong>:</p>
                    <ul className="list-disc list-inside ml-2">
                      <li><code className="text-primary">change_password</code> → retorna success: true, mas <strong>NÃO altera</strong> a senha real</li>
                      <li><code className="text-primary">change_coercion_password</code> → retorna success: true, mas <strong>NÃO altera</strong> nada</li>
                      <li><code className="text-primary">validate_password</code> → retorna success: true normalmente</li>
                    </ul>
                    <p className="mt-1.5 font-semibold">O app NUNCA deve revelar que detectou coação. Nenhuma diferença visual.</p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Fluxo E */}
          <AccordionItem value="flow-e">
            <AccordionTrigger className="text-xs font-semibold hover:no-underline">
              Fluxo E - Heartbeat e Telemetria GPS
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p><code className="text-primary">pingMobile</code> é o heartbeat principal - envia status completo do dispositivo + GPS a cada 1 segundo.</p>
                  <p><strong>Campos obrigatórios:</strong> session_token</p>
                  <p><strong>Campos recomendados:</strong> device_id, bateria_percentual, is_charging, is_recording, is_monitoring, dispositivo_info, versao_app, timezone, latitude, longitude, location_accuracy, location_timestamp, speed, heading</p>
                </div>

                <div className="rounded-md bg-muted/50 border border-border p-2 space-y-1.5">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase">Deduplicação GPS</p>
                  <p className="text-xs text-muted-foreground">
                    Se <code className="text-primary">timestamp_gps</code> (ou <code className="text-primary">location_timestamp</code>) já existir para a usuária,
                    o registro GPS é silenciosamente ignorado. O app deve garantir que cada leitura GPS tenha um timestamp único.
                  </p>
                </div>

                <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                  <p className="text-xs font-semibold text-primary">pingMobile vs enviarLocalizacaoGPS</p>
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>• <code className="text-primary">pingMobile</code> já registra GPS automaticamente quando lat/lng estão presentes no payload</p>
                    <p>• <code className="text-primary">enviarLocalizacaoGPS</code> é para envios dedicados adicionais (ex: rastreamento em pânico com frequência maior)</p>
                    <p>• Snap-to-road e auto-follow são processamento do <strong>frontend</strong>, não do backend</p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

function ErrorHandlingTable() {
  const errors = [
    { code: "RATE_LIMITED", http: 429, action: "Aguardar 15 minutos antes de tentar novamente. Exibir mensagem: 'Muitas tentativas. Aguarde 15 minutos.'" },
    { code: "SESSION_EXPIRED", http: 401, action: "Chamar refresh_token com o refresh_token armazenado. Se falhar (token já usado/expirado) → redirecionar para tela de login." },
    { code: "PANIC_ACTIVE_CANNOT_LOGOUT", http: 403, action: "Exibir mensagem: 'Não é possível sair com pânico ativo. Cancele o alerta primeiro.' Bloquear botão de logout." },
    { code: "DEVICE_MISMATCH", http: 400, action: "O device_id enviado não corresponde ao registrado no pânico/monitoramento ativo. Reautenticar o dispositivo (novo login)." },
    { code: "DEVICE_ID_REQUIRED", http: 400, action: "Há pânico ou monitoramento ativo mas device_id não foi enviado. Incluir device_id em todas as chamadas subsequentes." },
    { code: "INVALID_CREDENTIALS", http: 401, action: "Senha incorreta. Exibir 'Email ou senha incorretos.' Atenção ao rate limit (5 tentativas)." },
    { code: "USER_NOT_FOUND", http: 404, action: "Email não cadastrado. Redirecionar para tela de cadastro ou exibir mensagem genérica." },
    { code: "SESSION_NOT_FOUND", http: 401, action: "Token inválido ou expirado. Tentar refresh_token; se falhar → tela de login." },
  ];

  return (
    <Card>
      <CardContent className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <p className="text-sm font-semibold text-foreground">Tratamento de Erros</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Tabela de erros comuns retornados pela API e como o app deve reagir a cada um.
        </p>

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Código</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">HTTP</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Ação do App</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((e) => (
                <tr key={e.code} className="border-t border-border">
                  <td className="px-3 py-1.5 font-mono text-destructive whitespace-nowrap">{e.code}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{e.http}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{e.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DocApiPage() {
  const fases = [
    { num: 1, label: "Autenticação & Sincronização" },
    { num: 2, label: "Sessão & Configuração" },
    { num: 3, label: "GPS & Pânico" },
    { num: 4, label: "Áudio & Monitoramento" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">AMPARA Mobile API</h1>
          <p className="text-sm text-muted-foreground mt-1">Documentação técnica para integração com os apps mobile - <Badge variant="outline" className="text-[10px] ml-1">v2.2</Badge></p>
        </div>

        {/* Connection Info */}
        <Card>
          <CardContent className="px-4 py-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Informações de Conexão</p>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Base URL</p>
              <CodeBlock code={BASE_URL} />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">API Key (header <code className="text-primary">apikey</code>)</p>
              <CodeBlock code={API_KEY} />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Método</p>
              <p className="text-sm font-mono text-foreground">POST (todas as actions)</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Headers obrigatórios</p>
              <CodeBlock code={`Content-Type: application/json\napikey: <API_KEY>`} />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Exemplo cURL</p>
              <CodeBlock
                code={`curl -X POST "${BASE_URL}" \\\n  -H "Content-Type: application/json" \\\n  -H "apikey: <API_KEY>" \\\n  -d '{"action": "loginCustomizado", "email": "user@example.com", "senha": "123456"}'`}
                label="cURL"
              />
            </div>
          </CardContent>
        </Card>

        {/* NEW: Quick Integration Guide */}
        <QuickIntegrationGuide />

        {/* NEW: Usage Flows */}
        <UsageFlows />

        {/* NEW: Error Handling */}
        <ErrorHandlingTable />

        {/* Rate Limiting */}
        <Card>
          <CardContent className="px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Rate Limiting</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Login:</strong> 5 tentativas / 15 minutos (por email + IP)</li>
              <li><strong>Validar senha:</strong> 5 tentativas / 15 minutos</li>
              <li><strong>Alterar senha:</strong> 5 tentativas / 15 minutos</li>
              <li><strong>Alterar senha de coação:</strong> 5 tentativas / 15 minutos</li>
            </ul>
          </CardContent>
        </Card>

        {/* Deduplicação GPS & Grace Window */}
        <Card>
          <CardContent className="px-4 py-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">🔄 Deduplicação GPS & Janela de Graça (Grace Window)</p>
            
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Deduplicação de GPS</p>
                <p className="text-xs text-muted-foreground">
                  Tanto <code className="text-primary">pingMobile</code> quanto <code className="text-primary">enviarLocalizacaoGPS</code> verificam 
                  se já existe um registro com o mesmo <code className="text-primary">timestamp_gps</code> para a usuária.
                  Se existir, a inserção é <strong>silenciosamente ignorada</strong> (sem erro). O app deve garantir que cada leitura 
                  GPS tenha um timestamp único para evitar perda de dados.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">Janela de Graça para Áudio (60 segundos)</p>
                <p className="text-xs text-muted-foreground">
                  Quando o app envia um segmento de áudio via <code className="text-primary">receberAudioMobile</code> e não há sessão 
                  de monitoramento ativa, o backend verifica se existe uma sessão <strong>selada nos últimos 60 segundos</strong>.
                  Se encontrar, o segmento é anexado a essa sessão (segmento tardio). Caso contrário, é salvo como 
                  gravação independente (órfã) e enviado para processamento automático.
                </p>
                <div className="rounded-md bg-muted/50 border border-border p-2 mt-2">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Fluxo de decisão</p>
                  <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">{`1. Sessão ativa encontrada? → Anexar segmento (normal)
2. Sessão selada há < 60s? → Anexar como tardio (grace window)
3. Nenhuma sessão? → Salvar como gravação independente (órfã)`}</pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aliases de Actions */}
        <Card>
          <CardContent className="px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">🔀 Aliases de Actions</p>
            <p className="text-xs text-muted-foreground">
              Algumas actions possuem aliases - nomes alternativos que executam exatamente o mesmo handler no backend.
              O app pode usar qualquer um dos nomes listados abaixo:
            </p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Action Principal</th>
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Aliases</th>
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Uso recomendado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="px-3 py-1.5 font-mono text-primary">reportarStatusGravacao</td>
                    <td className="px-3 py-1.5 font-mono text-primary">iniciarGravacao, pararGravacao, finalizarGravacao</td>
                    <td className="px-3 py-1.5 text-muted-foreground">Usar o alias que melhor descreve a intenção (ex: iniciarGravacao com status_gravacao='iniciada')</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Arquitetura de Telemetria Mobile */}
        <Card>
          <CardContent className="px-4 py-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">📡 Arquitetura de Telemetria Mobile (Android)</p>
            <p className="text-xs text-muted-foreground">
              O envio de localização e status ocorre por múltiplos mecanismos com frequências distintas:
            </p>

            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-foreground">1. Heartbeat Nativo (KeepAliveService)</p>
                <p className="text-xs text-muted-foreground">
                  Serviço de segundo plano que usa <code className="text-primary">AlarmManager</code> para garantir envio mesmo em Doze Mode.
                  Envia <code className="text-primary">pingMobile</code> com status do dispositivo + localização GPS.
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1">
                  <li><strong>Normal:</strong> a cada 1 segundo</li>
                  <li><strong>Pânico:</strong> a cada 1 segundo</li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">2. Upload de Áudio (NativeRecorder)</p>
                <p className="text-xs text-muted-foreground">
                  Durante gravação (manual ou automática), o áudio é dividido em segmentos de 30s.
                  Cada segmento enviado via <code className="text-primary">receberAudioMobile</code> inclui a localização GPS atual no payload.
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1">
                  <li><strong>Intervalo:</strong> a cada 30 segundos (1 segmento)</li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">3. Hook de Localização (JavaScript / useLocation)</p>
                <p className="text-xs text-muted-foreground">
                  Camada React Native/Capacitor que envia coordenadas via <code className="text-primary">enviarLocalizacaoGPS</code>.
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1">
                  <li><strong>Normal:</strong> a cada 1 segundo</li>
                  <li><strong>Pânico:</strong> a cada 1 segundo</li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">4. Eventos Imediatos</p>
                <p className="text-xs text-muted-foreground">
                  Localização enviada instantaneamente quando:
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1">
                  <li>Modo de pânico é ativado</li>
                  <li>Gravação é iniciada (manual ou por gatilho de áudio)</li>
                </ul>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 border border-border p-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">Resumo de Frequências</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Ping de Status + GPS</span>
                <span className="font-mono text-foreground">1s (contínuo)</span>
                <span className="text-muted-foreground">Upload de Áudio</span>
                <span className="font-mono text-foreground">30s (com GPS)</span>
                <span className="text-muted-foreground">Tracking JS</span>
                <span className="font-mono text-foreground">1s (contínuo)</span>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 border border-border p-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">Processamento Visual no Frontend</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><strong>Snap-to-Road:</strong> Cada posição recebida é ajustada via Mapbox Map Matching API para encaixar na via mais próxima (raio de 25m). O sistema utiliza os últimos 5 pontos para maior precisão na correspondência de rota.</p>
                <p><strong>Auto-Follow (estilo Life360):</strong> O mapa centraliza automaticamente no marcador a cada nova localização com transição suave (800ms). Ao interagir manualmente (arrastar/zoom), o auto-follow pausa por 10s e reativa automaticamente. O botão de centralizar permite reativar o seguimento instantaneamente.</p>
                <p><strong>Animação de Marcador:</strong> Transição suave entre posições com interpolação easeInOutQuad (800ms), sem saltos bruscos.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Análise de IA */}
        <Card>
          <CardContent className="px-4 py-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">🧠 Análise de IA - Campos de Retorno</p>
            <p className="text-xs text-muted-foreground">
              A análise de cada gravação retorna um JSON com os seguintes campos dentro de <code className="text-primary">analise_completa</code>:
            </p>

            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold text-foreground">Campos Padrão</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1">
                  <li><code className="text-primary">resumo</code> - Resumo da conversa</li>
                  <li><code className="text-primary">sentimento</code> - negativo, neutro, positivo, misto</li>
                  <li><code className="text-primary">nivel_risco</code> - critico, alto, moderado, baixo, informativo</li>
                  <li><code className="text-primary">categorias</code> - Array de categorias detectadas</li>
                  <li><code className="text-primary">palavras_chave</code> - Termos mais relevantes</li>
                  <li><code className="text-primary">xingamentos</code> - Xingamentos detectados</li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">Novos Campos - Táticas Manipulativas</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1">
                  <li><code className="text-primary">taticas_manipulativas</code> - Array de objetos com: <code className="text-primary">tatica</code>, <code className="text-primary">descricao</code>, <code className="text-primary">evidencia</code>, <code className="text-primary">gravidade</code></li>
                  <li><code className="text-primary">orientacoes_vitima</code> - Array de strings com orientações práticas para a mulher</li>
                  <li><code className="text-primary">sinais_alerta</code> - Array de strings com sinais de alerta identificados</li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">Tipos de Táticas Detectadas</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 mt-1">
                  <li><strong>instrumentalizacao_filhos</strong> - Usar guarda/bem-estar dos filhos como ameaça ou pressão</li>
                  <li><strong>falsa_demonstracao_afeto</strong> - Declarar amor/preocupação para manter controle</li>
                  <li><strong>ameaca_juridica_velada</strong> - Mencionar advogado/justiça como intimidação</li>
                  <li><strong>acusacoes_sem_evidencia</strong> - Boatos, "ouvi dizer", difamação indireta</li>
                  <li><strong>gaslighting</strong> - Negar intenções claras, "você está exagerando"</li>
                  <li><strong>vitimizacao_reversa</strong> - Se colocar como parte prejudicada</li>
                  <li><strong>controle_disfarçado</strong> - Controle sob pretexto de preocupação/conselho</li>
                </ul>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5">Exemplo de Retorno</p>
              <CodeBlock
                code={JSON.stringify({
                  taticas_manipulativas: [
                    { tatica: "instrumentalizacao_filhos", descricao: "Usa guarda dos filhos como pressão", evidencia: "\"vou pedir a guarda se você não...\"", gravidade: "alta" }
                  ],
                  orientacoes_vitima: [
                    "Documente por escrito todas as ameaças envolvendo os filhos",
                    "Acusações baseadas em 'ouvi dizer' não têm validade legal sem provas"
                  ],
                  sinais_alerta: ["uso de filhos como barganha", "ameaça jurídica velada"]
                }, null, 2)}
                label="analise_completa (novos campos)"
              />
            </div>
          </CardContent>
        </Card>

        {/* Anti-coerção */}
        <Card>
          <CardContent className="px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">⚠️ Comportamento Anti-Coerção</p>
            <p className="text-xs text-muted-foreground">
              Quando a <strong>senha de coação</strong> é usada no login, change_password, change_coercion_password ou validate_password,
              o sistema retorna <code className="text-primary">success: true</code> mas registra silenciosamente
              o evento nos logs de auditoria. Nenhuma alteração real é feita no banco. O campo <code className="text-primary">loginTipo</code> retorna
              <code className="text-primary">"coacao"</code> - o app deve tratar isso de forma discreta.
            </p>
          </CardContent>
        </Card>

        {/* Endpoints by phase */}
        {fases.map((fase) => {
          const faseEndpoints = ENDPOINTS.filter((e) => e.fase === fase.num);
          return (
            <div key={fase.num} className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">
                Fase {fase.num} - {fase.label}
              </h2>
              <div className="space-y-2">
                {faseEndpoints.map((ep) => (
                  <EndpointCard key={ep.action} endpoint={ep} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground text-center">
            AMPARA Mobile API v2.2 - Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>
    </div>
  );
}
