/**
 * AMPARA Reverse Geocoding Service
 * 
 * Features:
 * - In-memory cache with TTL (5 min)
 * - Key normalization (4 decimal places ≈ 11m)
 * - Request deduplication (concurrent calls share one fetch)
 * - Rate limiting (max 1 req/sec to Nominatim)
 * - Resilient fallback on errors (429, timeout, 5xx)
 * 
 * Nominatim response example:
 * {
 *   "display_name": "Rua Augusta, Consolação, São Paulo, SP, 01305-100, Brasil",
 *   "address": {
 *     "road": "Rua Augusta",
 *     "suburb": "Consolação",
 *     "city": "São Paulo",
 *     "state": "São Paulo",
 *     "state_code": "SP",
 *     "postcode": "01305-100",
 *     "country": "Brasil"
 *   }
 * }
 * 
 * Transformed to:
 * {
 *   display_address: "Rua Augusta, Consolação, São Paulo - SP",
 *   full_address: "Rua Augusta, Consolação, São Paulo, SP, 01305-100, Brasil",
 *   provider: "nominatim",
 *   cached: false,
 *   resolved_at: "2026-02-11T..."
 * }
 */

export interface GeoResult {
  display_address: string;
  full_address: string;
  provider: string;
  cached: boolean;
  resolved_at: string;
}

interface CacheEntry {
  result: GeoResult;
  expires_at: number;
}

// ── Config ──────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes
const DECIMALS = 4; // ~11m precision
const RATE_LIMIT_MS = 1_000; // 1 req/sec
const FETCH_TIMEOUT_MS = 6_000;
const BACKOFF_ON_429_MS = 10_000;
const USER_AGENT = "AMPARA/1.0 (contato@amparamulher.com.br)";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

// ── State (module-level singleton) ──────────────────────
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<GeoResult>>();
let lastRequestTime = 0;
let backoffUntil = 0;

// ── Helpers ─────────────────────────────────────────────

/** Round to N decimal places */
export function roundCoord(value: number, decimals: number = DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Build cache key from lat/lon */
export function makeCacheKey(lat: number, lon: number): string {
  return `${roundCoord(lat)},${roundCoord(lon)}`;
}

/** Format Nominatim response into short address */
function formatAddress(data: any): { display: string; full: string } {
  const full = data.display_name || "";
  const addr = data.address || {};

  const parts: string[] = [];
  if (addr.road) {
    parts.push(addr.house_number ? `${addr.road}, ${addr.house_number}` : addr.road);
  }
  if (addr.suburb) parts.push(addr.suburb);
  const city = addr.city || addr.town || addr.village || addr.municipality || "";
  if (city) parts.push(city);
  const state = addr.state_code || addr.state || "";
  
  let display: string;
  if (parts.length > 0 && state) {
    display = `${parts.join(", ")} - ${state}`;
  } else if (parts.length > 0) {
    display = parts.join(", ");
  } else {
    display = full;
  }

  return { display, full };
}

/** Wait until rate limit window passes */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();

  // Backoff after 429
  if (now < backoffUntil) {
    await new Promise((r) => setTimeout(r, backoffUntil - now));
  }

  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
}

/** Fetch with timeout */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Metrics (lightweight) ───────────────────────────────
let metrics = { cache_hit: 0, cache_miss: 0, provider_error: 0 };
export function getMetrics() {
  return { ...metrics };
}
export function resetMetrics() {
  metrics = { cache_hit: 0, cache_miss: 0, provider_error: 0 };
}

// ── Core ────────────────────────────────────────────────

async function fetchFromProvider(lat: number, lon: number): Promise<GeoResult> {
  await waitForRateLimit();
  lastRequestTime = Date.now();

  const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lon}&format=json&accept-language=pt-BR&addressdetails=1`;

  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);

    if (res.status === 429) {
      backoffUntil = Date.now() + BACKOFF_ON_429_MS;
      metrics.provider_error++;
      return fallbackResult(lat, lon);
    }

    if (!res.ok) {
      metrics.provider_error++;
      return fallbackResult(lat, lon);
    }

    const data = await res.json();
    const { display, full } = formatAddress(data);
    metrics.cache_miss++;

    return {
      display_address: display,
      full_address: full,
      provider: "nominatim",
      cached: false,
      resolved_at: new Date().toISOString(),
    };
  } catch {
    metrics.provider_error++;
    return fallbackResult(lat, lon);
  }
}

function fallbackResult(lat: number, lon: number): GeoResult {
  return {
    display_address: "Endereço indisponível",
    full_address: `${lat}, ${lon}`,
    provider: "fallback",
    cached: false,
    resolved_at: new Date().toISOString(),
  };
}

/**
 * Resolve address from lat/lon.
 * Uses cache, deduplication, and rate limiting.
 */
export async function resolveAddress(lat: number, lon: number): Promise<GeoResult> {
  const key = makeCacheKey(lat, lon);

  // 1. Check cache
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expires_at) {
    metrics.cache_hit++;
    return { ...cached.result, cached: true };
  }

  // 2. Deduplication — reuse inflight promise
  const existing = inflight.get(key);
  if (existing) {
    const result = await existing;
    return { ...result, cached: true };
  }

  // 3. Fetch from provider (deduplicated)
  const promise = fetchFromProvider(lat, lon).then((result) => {
    // Store in cache even if fallback (prevents hammering on error)
    cache.set(key, { result, expires_at: Date.now() + CACHE_TTL_MS });
    inflight.delete(key);
    return result;
  });

  inflight.set(key, promise);
  return promise;
}

/** Clear entire cache (useful for testing) */
export function clearCache() {
  cache.clear();
  inflight.clear();
  lastRequestTime = 0;
  backoffUntil = 0;
}

/** Expose internals for testing only */
export const _testInternals = {
  get cacheSize() { return cache.size; },
  get inflightSize() { return inflight.size; },
  get lastRequestTime() { return lastRequestTime; },
  set lastRequestTime(v: number) { lastRequestTime = v; },
  get backoffUntil() { return backoffUntil; },
  set backoffUntil(v: number) { backoffUntil = v; },
  RATE_LIMIT_MS,
};
