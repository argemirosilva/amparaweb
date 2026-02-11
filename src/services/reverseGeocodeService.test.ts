import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveAddress,
  makeCacheKey,
  roundCoord,
  clearCache,
  getMetrics,
  resetMetrics,
  _testInternals,
} from "@/services/reverseGeocodeService";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function nominatimResponse(road = "Rua Augusta", suburb = "Consolação", city = "São Paulo", stateCode = "SP") {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        display_name: `${road}, ${suburb}, ${city}, ${stateCode}, Brasil`,
        address: { road, suburb, city, state_code: stateCode },
      }),
  };
}

beforeEach(() => {
  clearCache();
  resetMetrics();
  mockFetch.mockReset();
  _testInternals.lastRequestTime = 0;
  _testInternals.backoffUntil = 0;
});

describe("roundCoord / makeCacheKey", () => {
  it("rounds to 4 decimal places by default", () => {
    expect(roundCoord(-23.561234567)).toBe(-23.5612);
    expect(roundCoord(-46.656789012)).toBe(-46.6568);
  });

  it("same ~11m area produces same key", () => {
    // These two points differ by ~5m
    const k1 = makeCacheKey(-23.5612, -46.6568);
    const k2 = makeCacheKey(-23.56124, -46.65683);
    expect(k1).toBe(k2);
  });

  it("different areas produce different keys", () => {
    const k1 = makeCacheKey(-23.5612, -46.6568);
    const k2 = makeCacheKey(-23.5620, -46.6568);
    expect(k1).not.toBe(k2);
  });
});

describe("cache TTL", () => {
  it("returns cached result within TTL", async () => {
    mockFetch.mockResolvedValueOnce(nominatimResponse());

    const r1 = await resolveAddress(-23.5612, -46.6568);
    expect(r1.cached).toBe(false);
    expect(r1.display_address).toContain("Rua Augusta");

    const r2 = await resolveAddress(-23.5612, -46.6568);
    expect(r2.cached).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1); // no second call
  });

  it("tracks cache_hit and cache_miss metrics", async () => {
    mockFetch.mockResolvedValueOnce(nominatimResponse());

    await resolveAddress(-23.5612, -46.6568);
    await resolveAddress(-23.5612, -46.6568);

    const m = getMetrics();
    expect(m.cache_miss).toBe(1);
    expect(m.cache_hit).toBe(1);
  });
});

describe("deduplication", () => {
  it("concurrent calls for same key produce only 1 fetch", async () => {
    let resolvePromise: (v: any) => void;
    const pending = new Promise((r) => { resolvePromise = r; });

    mockFetch.mockReturnValueOnce(
      pending.then(() => nominatimResponse())
    );

    const p1 = resolveAddress(-23.5612, -46.6568);
    const p2 = resolveAddress(-23.5612, -46.6568);
    const p3 = resolveAddress(-23.5612, -46.6568);

    resolvePromise!(undefined);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1.display_address).toContain("Rua Augusta");
    expect(r2.cached).toBe(true);
    expect(r3.cached).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("rate limiting", () => {
  it("spaces requests at least 1 second apart", async () => {
    mockFetch
      .mockResolvedValueOnce(nominatimResponse("Rua A"))
      .mockResolvedValueOnce(nominatimResponse("Rua B"));

    const start = Date.now();
    await resolveAddress(-23.0001, -46.0001);
    await resolveAddress(-23.0010, -46.0010); // different key
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(_testInternals.RATE_LIMIT_MS - 50); // small tolerance
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("fallback on errors", () => {
  it("returns fallback on 429 and sets backoff", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const r = await resolveAddress(-23.5612, -46.6568);
    expect(r.display_address).toBe("Endereço indisponível");
    expect(r.provider).toBe("fallback");
    expect(getMetrics().provider_error).toBe(1);
    expect(_testInternals.backoffUntil).toBeGreaterThan(Date.now());
  });

  it("returns fallback on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const r = await resolveAddress(-23.5612, -46.6568);
    expect(r.display_address).toBe("Endereço indisponível");
    expect(r.provider).toBe("fallback");
  });

  it("returns fallback on 5xx", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const r = await resolveAddress(-23.5612, -46.6568);
    expect(r.provider).toBe("fallback");
  });
});
