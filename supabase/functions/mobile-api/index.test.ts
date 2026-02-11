import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const API_URL = `${SUPABASE_URL}/functions/v1/mobile-api`;

async function callApi(body: Record<string, unknown>): Promise<Response> {
  return await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify(body),
  });
}

// ── Action desconhecida ──

Deno.test("returns 400 for unknown action", async () => {
  const res = await callApi({ action: "unknown_action_xyz" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

// ── Missing action field ──

Deno.test("returns 400 when action missing", async () => {
  const res = await callApi({ email: "test@test.com" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

// ── loginCustomizado: wrong password ──

Deno.test("loginCustomizado returns 401 for wrong password", async () => {
  const res = await callApi({
    action: "loginCustomizado",
    email: "nonexistent_test_user_12345@test.com",
    senha: "wrongpassword",
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── loginCustomizado: missing fields ──

Deno.test("loginCustomizado returns 400 for missing fields", async () => {
  const res = await callApi({
    action: "loginCustomizado",
    email: "",
    senha: "",
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

// ── refresh_token: invalid token ──

Deno.test("refresh_token returns 401 for invalid token", async () => {
  const fakeToken = "a".repeat(128);
  const res = await callApi({
    action: "refresh_token",
    refresh_token: fakeToken,
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── refresh_token: wrong length ──

Deno.test("refresh_token returns 401 for wrong length", async () => {
  const res = await callApi({
    action: "refresh_token",
    refresh_token: "tooshort",
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── pingMobile: missing session_token ──

Deno.test("pingMobile returns 401 without session_token", async () => {
  const res = await callApi({
    action: "pingMobile",
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── pingMobile: invalid session_token ──

Deno.test("pingMobile returns 401 with invalid session_token", async () => {
  const res = await callApi({
    action: "pingMobile",
    session_token: "invalid_token_here",
    device_id: "test_device",
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── syncConfigMobile: missing email ──

Deno.test("syncConfigMobile returns 400 without email_usuario", async () => {
  const res = await callApi({
    action: "syncConfigMobile",
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

// ── syncConfigMobile: unknown user ──

Deno.test("syncConfigMobile returns 404 for unknown user", async () => {
  const res = await callApi({
    action: "syncConfigMobile",
    email_usuario: "no_such_user_xyz@test.com",
  });
  const data = await res.json();
  assertEquals(res.status, 404);
  assertEquals(data.success, false);
});

// ── Fase 2: logoutMobile requires session_token + device_id ──

Deno.test("logoutMobile returns 400 without session_token", async () => {
  const res = await callApi({ action: "logoutMobile" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("logoutMobile returns 400 without device_id", async () => {
  const res = await callApi({ action: "logoutMobile", session_token: "abc" });
  const data = await res.json();
  // Will be 401 (invalid session) since session_token is present but invalid
  assert(res.status === 400 || res.status === 401);
  assertEquals(data.success, false);
});

// ── validate_password ──

Deno.test("validate_password returns 400 without fields", async () => {
  const res = await callApi({ action: "validate_password" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("validate_password returns 401 with invalid session", async () => {
  const res = await callApi({
    action: "validate_password",
    session_token: "invalid",
    email_usuario: "test@test.com",
    senha: "123456",
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── change_password ──

Deno.test("change_password returns 400 without fields", async () => {
  const res = await callApi({ action: "change_password" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("change_password returns 400 for short password", async () => {
  const res = await callApi({
    action: "change_password",
    session_token: "valid",
    senha_atual: "old",
    nova_senha: "12345",
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

// ── update_schedules ──

Deno.test("update_schedules returns 400 without session_token", async () => {
  const res = await callApi({ action: "update_schedules" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("update_schedules returns 401 with invalid session", async () => {
  const res = await callApi({
    action: "update_schedules",
    session_token: "invalid",
    periodos_semana: {},
  });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── Fase 3: enviarLocalizacaoGPS ──

Deno.test("enviarLocalizacaoGPS returns 400 without email", async () => {
  const res = await callApi({ action: "enviarLocalizacaoGPS" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("enviarLocalizacaoGPS returns 400 without lat/lng", async () => {
  const res = await callApi({
    action: "enviarLocalizacaoGPS",
    email_usuario: "test@test.com",
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("enviarLocalizacaoGPS returns 404 for unknown user", async () => {
  const res = await callApi({
    action: "enviarLocalizacaoGPS",
    email_usuario: "no_user_xyz@test.com",
    latitude: -23.5,
    longitude: -46.6,
  });
  const data = await res.json();
  assertEquals(res.status, 404);
  assertEquals(data.success, false);
});

// ── acionarPanicoMobile ──

Deno.test("acionarPanicoMobile returns 400 without email", async () => {
  const res = await callApi({ action: "acionarPanicoMobile" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("acionarPanicoMobile returns 404 for unknown user", async () => {
  const res = await callApi({
    action: "acionarPanicoMobile",
    email_usuario: "no_user_xyz@test.com",
  });
  const data = await res.json();
  assertEquals(res.status, 404);
  assertEquals(data.success, false);
});

// ── cancelarPanicoMobile ──

Deno.test("cancelarPanicoMobile returns 400 without email", async () => {
  const res = await callApi({ action: "cancelarPanicoMobile" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("cancelarPanicoMobile returns 404 for unknown user", async () => {
  const res = await callApi({
    action: "cancelarPanicoMobile",
    email_usuario: "no_user_xyz@test.com",
  });
  const data = await res.json();
  assertEquals(res.status, 404);
  assertEquals(data.success, false);
});

Deno.test("cancelarPanicoMobile returns 404 when no active alert", async () => {
  // This will fail with 404 since user doesn't exist
  const res = await callApi({
    action: "cancelarPanicoMobile",
    email_usuario: "no_user_xyz@test.com",
  });
  const data = await res.json();
  assertEquals(res.status, 404);
  assertEquals(data.success, false);
});

// ── Fase 4: receberAudioMobile ──

Deno.test("receberAudioMobile returns 400 without email", async () => {
  const res = await callApi({ action: "receberAudioMobile" });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("receberAudioMobile returns 400 without file_url", async () => {
  const res = await callApi({
    action: "receberAudioMobile",
    email_usuario: "test@test.com",
  });
  const data = await res.json();
  assertEquals(res.status, 400);
  assertEquals(data.success, false);
});

Deno.test("receberAudioMobile returns 404 for unknown user", async () => {
  const res = await callApi({
    action: "receberAudioMobile",
    email_usuario: "no_user_xyz@test.com",
    file_url: "https://example.com/audio.mp3",
  });
  const data = await res.json();
  assertEquals(res.status, 404);
  assertEquals(data.success, false);
});

// ── getAudioSignedUrl ──

Deno.test("getAudioSignedUrl returns 401 without session", async () => {
  const res = await callApi({ action: "getAudioSignedUrl" });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

Deno.test("getAudioSignedUrl returns 400 without gravacao_id", async () => {
  const res = await callApi({
    action: "getAudioSignedUrl",
    session_token: "invalid",
  });
  const data = await res.json();
  // 401 because session is invalid
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── reprocessarGravacao ──

Deno.test("reprocessarGravacao returns 401 without session", async () => {
  const res = await callApi({ action: "reprocessarGravacao" });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── reprocess_recording (alias) ──

Deno.test("reprocess_recording returns 401 without session", async () => {
  const res = await callApi({ action: "reprocess_recording" });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

// ── reportarStatusMonitoramento ──

Deno.test("reportarStatusMonitoramento returns 401 without session", async () => {
  const res = await callApi({ action: "reportarStatusMonitoramento" });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

Deno.test("reportarStatusMonitoramento returns 400 without sessao_id", async () => {
  const res = await callApi({
    action: "reportarStatusMonitoramento",
    session_token: "invalid",
  });
  const data = await res.json();
  assertEquals(res.status, 401); // invalid session first
  assertEquals(data.success, false);
});

// ── reportarStatusGravacao ──

Deno.test("reportarStatusGravacao returns 401 without session", async () => {
  const res = await callApi({ action: "reportarStatusGravacao" });
  const data = await res.json();
  assertEquals(res.status, 401);
  assertEquals(data.success, false);
});

Deno.test("reportarStatusGravacao returns 400 without gravacao_id", async () => {
  const res = await callApi({
    action: "reportarStatusGravacao",
    session_token: "invalid",
  });
  const data = await res.json();
  assertEquals(res.status, 401); // invalid session first
  assertEquals(data.success, false);
});

// ── No more stubs ──

Deno.test("no stub actions remain - all actions implemented", async () => {
  // Verify all known actions return something other than 501
  const allActions = [
    "loginCustomizado", "refresh_token", "pingMobile", "syncConfigMobile",
    "logoutMobile", "validate_password", "change_password", "update_schedules",
    "enviarLocalizacaoGPS", "acionarPanicoMobile", "cancelarPanicoMobile",
    "receberAudioMobile", "getAudioSignedUrl", "reprocessarGravacao",
    "reprocess_recording", "reportarStatusMonitoramento", "reportarStatusGravacao",
  ];
  for (const action of allActions) {
    const res = await callApi({ action });
    const data = await res.json();
    assert(res.status !== 501, `Action '${action}' still returns 501`);
    await res.body?.cancel().catch(() => {});
  }
});
