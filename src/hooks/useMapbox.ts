import { useState, useEffect } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let cachedToken: string | null = null;
let tokenFetchPromise: Promise<string | null> | null = null;
let mapboxModule: typeof import("mapbox-gl") | null = null;
let moduleLoadPromise: Promise<typeof import("mapbox-gl")> | null = null;

async function fetchMapboxToken(): Promise<string | null> {
  if (cachedToken) { console.log("[useMapbox] token from cache"); return cachedToken; }
  if (tokenFetchPromise) { console.log("[useMapbox] token fetch already in progress"); return tokenFetchPromise; }

  tokenFetchPromise = (async () => {
    try {
      const url = `${SUPABASE_URL}/functions/v1/mapbox-token`;
      console.log("[useMapbox] fetching token from", url);
      const res = await fetch(url, {
        headers: { apikey: SUPABASE_KEY },
      });
      console.log("[useMapbox] token response status:", res.status);
      if (!res.ok) return null;
      const data = await res.json();
      console.log("[useMapbox] token data:", data?.token ? "received" : "missing");
      if (!data?.token) return null;
      cachedToken = data.token;
      return cachedToken;
    } catch (err) {
      console.error("[useMapbox] token fetch error:", err);
      return null;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}

async function loadMapboxModule(): Promise<typeof import("mapbox-gl")> {
  if (mapboxModule) { console.log("[useMapbox] module from cache"); return mapboxModule; }
  if (moduleLoadPromise) { console.log("[useMapbox] module load in progress"); return moduleLoadPromise; }

  console.log("[useMapbox] importing mapbox-gl module...");
  moduleLoadPromise = import("mapbox-gl").then((m) => {
    console.log("[useMapbox] module loaded, default:", typeof m.default);
    mapboxModule = m;
    return m;
  });

  return moduleLoadPromise;
}

export function useMapbox() {
  const [mapboxgl, setMapboxgl] = useState<typeof import("mapbox-gl").default | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mapboxgl) { console.log("[useMapbox] already initialized"); setLoading(false); return; }

    let cancelled = false;
    console.log("[useMapbox] initializing...");
    (async () => {
      const [token, mb] = await Promise.all([fetchMapboxToken(), loadMapboxModule()]);
      console.log("[useMapbox] token:", token ? "ok" : "MISSING", "module:", mb ? "ok" : "MISSING", "cancelled:", cancelled);
      if (cancelled) return;
      if (!token) {
        console.error("[useMapbox] no token, setting error");
        setError("Não foi possível carregar o mapa.");
        setLoading(false);
        return;
      }
      mb.default.accessToken = token;
      console.log("[useMapbox] accessToken set, mapboxgl ready");
      setMapboxgl(mb.default);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [mapboxgl]);

  return { mapboxgl, loading, error };
}
