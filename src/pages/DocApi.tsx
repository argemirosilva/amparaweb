import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Copy, Check } from "lucide-react";

const BASE_URL = "https://uogenwcycqykfsuongrl.supabase.co/functions/v1/mobile-api";
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2Vud2N5Y3F5a2ZzdW9uZ3JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4Mjg2NjIsImV4cCI6MjA4NjQwNDY2Mn0.hncTs6DDS-sbb8sT_QBOBf1mTcTu0e_Pc5yXo4tHZwE";

interface Endpoint {
  action: string;
  fase: number;
  description: string;
  auth: "session_token" | "email_usuario" | "refresh_token" | "nenhuma" | "session_token ou email_usuario";
  params: { name: string; type: string; required: boolean; description: string }[];
  response: Record<string, unknown>;
}

const ENDPOINTS: Endpoint[] = [
  // ── Fase 1: Autenticação & Sincronização ──
  {
    action: "loginCustomizado",
    fase: 1,
    description: "Autentica a usuária e retorna access_token + refresh_token. Detecta senha de coação silenciosamente. Rate limit: 5 tentativas / 15 min por email+IP.",
    auth: "nenhuma",
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
    description: "Heartbeat do dispositivo (30s normal / 10s pânico). Atualiza status de bateria, gravação, monitoramento. Se latitude/longitude estiverem presentes, registra localização automaticamente (vincula a alerta de pânico ativo se existir). Device único por usuária — novo device_id substitui o anterior.",
    auth: "session_token",
    params: [
      { name: "session_token", type: "string", required: true, description: "Token de sessão" },
      { name: "device_id", type: "string", required: false, description: "Identificador único do dispositivo" },
      { name: "bateria_percentual", type: "number", required: false, description: "Nível da bateria (0-100)" },
      { name: "is_charging", type: "boolean", required: false, description: "Se está carregando" },
      { name: "is_recording", type: "boolean", required: false, description: "Se está gravando" },
      { name: "is_monitoring", type: "boolean", required: false, description: "Se está monitorando" },
      { name: "dispositivo_info", type: "string", required: false, description: "Ex: 'Samsung Galaxy S21'" },
      { name: "versao_app", type: "string", required: false, description: "Versão do app. Ex: '1.2.3'" },
      { name: "timezone", type: "string", required: false, description: "Ex: 'America/Sao_Paulo'" },
      { name: "timezone_offset_minutes", type: "number", required: false, description: "Offset em minutos. Ex: -180" },
      { name: "latitude", type: "number", required: false, description: "Latitude GPS (se presente, registra localização)" },
      { name: "longitude", type: "number", required: false, description: "Longitude GPS (se presente, registra localização)" },
      { name: "location_accuracy", type: "number", required: false, description: "Precisão GPS em metros" },
      { name: "location_timestamp", type: "string|number", required: false, description: "Timestamp ISO ou Unix millis do GPS" },
      { name: "speed", type: "number", required: false, description: "Velocidade m/s" },
      { name: "heading", type: "number", required: false, description: "Direção em graus" },
    ],
    response: { success: true, status: "online", servidor_timestamp: "ISO8601" },
  },
  {
    action: "syncConfigMobile",
    fase: 1,
    description: "Sincroniza configurações do servidor para o app. Retorna agendamentos e estado da gravação. Cria sessão de monitoramento automaticamente se dentro de janela agendada.",
    auth: "session_token",
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
    description: "Registra localização GPS. Vincula automaticamente ao alerta de pânico ativo se existir. Validação de device_id quando há pânico/monitoramento ativo.",
    auth: "email_usuario",
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
      { name: "timestamp_gps", type: "string", required: false, description: "Timestamp ISO do GPS" },
    ],
    response: { success: true, message: "Localização registrada", alerta_id: "uuid | null", servidor_timestamp: "ISO8601" },
  },
  {
    action: "acionarPanicoMobile",
    fase: 3,
    description: "Aciona o botão de pânico. Gera protocolo único (AMP-YYYYMMDD-XXXXXX). Registra localização se fornecida. Notifica rede de apoio via WhatsApp (fire-and-forget).",
    auth: "email_usuario",
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "device_id", type: "string", required: false, description: "ID do dispositivo" },
      { name: "tipo_acionamento", type: "string", required: false, description: "botao_panico | comando_voz. Default: 'botao_panico'" },
      { name: "latitude", type: "number", required: false, description: "Latitude" },
      { name: "longitude", type: "number", required: false, description: "Longitude" },
    ],
    response: { success: true, alerta_id: "uuid", protocolo: "AMP-YYYYMMDD-XXXXXX", rede_apoio_notificada: true, autoridades_acionadas: true },
  },
  {
    action: "cancelarPanicoMobile",
    fase: 3,
    description: "Cancela alerta de pânico ativo. Se cancelado em <60s = dentro da janela (autoridades NÃO acionadas). Sela sessão de monitoramento ativa. Desativa compartilhamento GPS vinculado. Notifica rede de apoio que pânico foi resolvido.",
    auth: "email_usuario",
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
    action: "iniciarGravacao",
    fase: 4,
    description: "Inicia uma sessão de gravação. Cria sessão em monitoramento_sessoes com status 'ativa'. Se já existir sessão ativa para o device, retorna a existente. Alias de reportarStatusGravacao com status_gravacao='iniciada'.",
    auth: "email_usuario",
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "device_id", type: "string", required: true, description: "ID do dispositivo" },
      { name: "status_gravacao", type: "string", required: true, description: "Fixo: 'iniciada'" },
      { name: "origem_gravacao", type: "string", required: false, description: "automatico | botao_panico | agendado | comando_voz | botao_manual" },
    ],
    response: { success: true, message: "Sessão de gravação iniciada", sessao_id: "uuid", origem_gravacao: "automatico", servidor_timestamp: "ISO8601" },
  },
  {
    action: "receberAudioMobile",
    fase: 4,
    description: "Recebe segmento de áudio. Requer sessão de monitoramento ativa (enviar iniciarGravacao antes). Suporta JSON com file_url OU multipart/form-data com upload binário direto para R2. Idempotente via segmento_idx.",
    auth: "session_token ou email_usuario",
    params: [
      { name: "session_token", type: "string", required: false, description: "Token de sessão (alternativa a email_usuario)" },
      { name: "email_usuario", type: "string", required: false, description: "Email da usuária (alternativa a session_token)" },
      { name: "file_url", type: "string", required: false, description: "URL do arquivo (se JSON). Dispensável se multipart com arquivo binário." },
      { name: "device_id", type: "string", required: false, description: "ID do dispositivo" },
      { name: "duracao_segundos", type: "number", required: false, description: "Duração em segundos" },
      { name: "tamanho_mb", type: "number", required: false, description: "Tamanho em MB" },
      { name: "segmento_idx", type: "number", required: false, description: "Índice do segmento (para idempotência)" },
      { name: "timezone", type: "string", required: false, description: "Timezone" },
      { name: "timezone_offset_minutes", type: "number", required: false, description: "Offset em minutos" },
    ],
    response: { success: true, segmento_id: "uuid", monitor_session_id: "uuid", storage_path: "user_id/date/file.mp4", message: "Segmento de monitoramento salvo." },
  },
  {
    action: "getAudioSignedUrl",
    fase: 4,
    description: "Gera URL assinada para download de áudio. Verifica propriedade via gravacoes ou gravacoes_segmentos. Expira em 15 minutos (900s).",
    auth: "session_token ou email_usuario",
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
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "device_id", type: "string", required: true, description: "ID do dispositivo" },
      { name: "status_monitoramento", type: "string", required: true, description: "janela_iniciada | janela_finalizada | ativado | desativado | erro | retomado" },
      { name: "motivo", type: "string", required: false, description: "Motivo da mudança" },
      { name: "app_state", type: "string", required: false, description: "Estado do app (foreground, background, etc)" },
    ],
    response: { success: true, message: "Status de monitoramento atualizado", servidor_timestamp: "ISO8601" },
  },
  {
    action: "reportarStatusGravacao",
    fase: 4,
    description: "Reporta mudança de estado da gravação. Também acessível via aliases: iniciarGravacao, pararGravacao, finalizarGravacao. Finalização condicional: motivo_parada 'botao_manual' ou 'parada_panico' sela imediatamente. Outros motivos mantêm sessão ativa para o cron. Gravações com 0 segmentos são descartadas automaticamente.",
    auth: "email_usuario",
    params: [
      { name: "email_usuario", type: "string", required: true, description: "Email da usuária" },
      { name: "device_id", type: "string", required: false, description: "ID do dispositivo" },
      { name: "status_gravacao", type: "string", required: true, description: "iniciada | pausada | retomada | finalizada | enviando | erro" },
      { name: "origem_gravacao", type: "string", required: false, description: "automatico | botao_panico | agendado | comando_voz | botao_manual" },
      { name: "motivo_parada", type: "string", required: false, description: "Motivo da parada. Valores que selam imediatamente: 'botao_manual', 'manual', 'parada_panico'." },
      { name: "total_segmentos", type: "number", required: false, description: "Total de segmentos enviados (0 = descarta sessão)" },
    ],
    response: { success: true, message: "Status da gravação atualizado", sessao_id: "uuid", status: "aguardando_finalizacao | ativa | descartada", servidor_timestamp: "ISO8601" },
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
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <code className="text-sm font-mono font-semibold text-primary">{endpoint.action}</code>
              <Badge variant={authColor} className="text-[10px] shrink-0">{authLabel}</Badge>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
          </CardContent>
        </Card>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-1 pb-4 pt-2 space-y-3">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>

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
                      <td className="px-3 py-1.5">{p.required ? "✅" : "—"}</td>
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
        </div>
      </CollapsibleContent>
    </Collapsible>
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
          <p className="text-sm text-muted-foreground mt-1">Documentação técnica para integração com os apps mobile</p>
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

        {/* Rate Limiting */}
        <Card>
          <CardContent className="px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Rate Limiting</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li><strong>Login:</strong> 5 tentativas / 15 minutos (por email + IP)</li>
              <li><strong>Validar senha:</strong> 5 tentativas / 15 minutos</li>
              <li><strong>Alterar senha:</strong> 5 tentativas / 15 minutos</li>
            </ul>
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
                  <li><strong>Normal:</strong> a cada 30 segundos</li>
                  <li><strong>Pânico:</strong> a cada 10 segundos</li>
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
                  <li><strong>Normal:</strong> a cada 5 minutos</li>
                  <li><strong>Pânico:</strong> a cada 30 segundos</li>
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
                <span className="text-muted-foreground">Ping de Status</span>
                <span className="font-mono text-foreground">30s / 10s (pânico)</span>
                <span className="text-muted-foreground">Upload de Áudio</span>
                <span className="font-mono text-foreground">30s (com GPS)</span>
                <span className="text-muted-foreground">Tracking JS</span>
                <span className="font-mono text-foreground">5min / 30s (pânico)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anti-coerção */}
        <Card>
          <CardContent className="px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">⚠️ Comportamento Anti-Coerção</p>
            <p className="text-xs text-muted-foreground">
              Quando a <strong>senha de coação</strong> é usada no login, change_password ou validate_password,
              o sistema retorna <code className="text-primary">success: true</code> mas registra silenciosamente
              o evento nos logs de auditoria. Nenhuma alteração real é feita no banco. O campo <code className="text-primary">loginTipo</code> retorna
              <code className="text-primary">"coacao"</code> — o app deve tratar isso de forma discreta.
            </p>
          </CardContent>
        </Card>

        {/* Endpoints by phase */}
        {fases.map((fase) => {
          const faseEndpoints = ENDPOINTS.filter((e) => e.fase === fase.num);
          return (
            <div key={fase.num} className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">
                Fase {fase.num} — {fase.label}
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
            AMPARA Mobile API v2.0 — Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>
    </div>
  );
}
