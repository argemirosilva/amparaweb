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

// ── Stub actions return 501 ──

const stubActions = [
  "logoutMobile",
  "validate_password",
  "change_password",
  "update_schedules",
  "enviarLocalizacaoGPS",
  "acionarPanicoMobile",
  "cancelarPanicoMobile",
  "receberAudioMobile",
  "getAudioSignedUrl",
  "reprocessarGravacao",
  "reprocess_recording",
  "reportarStatusMonitoramento",
  "reportarStatusGravacao",
];

for (const action of stubActions) {
  Deno.test(`stub action '${action}' returns 501`, async () => {
    const res = await callApi({ action });
    const data = await res.json();
    assertEquals(res.status, 501);
    assertEquals(data.success, false);
    assertEquals(data.error, "NOT_IMPLEMENTED");
  });
}
