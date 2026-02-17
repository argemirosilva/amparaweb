import { useState, useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let cachedToken: string | null = null;
let tokenFetchPromise: Promise<string | null> | null = null;
let mapboxModule: typeof import("mapbox-gl") | null = null;
let moduleLoadPromise: Promise<typeof import("mapbox-gl")> | null = null;

async function fetchMapboxToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  if (tokenFetchPromise) return tokenFetchPromise;

  tokenFetchPromise = (async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mapbox-token`, {
        headers: { apikey: SUPABASE_KEY },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.token) return null;
      cachedToken = data.token;
      return cachedToken;
    } catch {
      return null;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}

async function loadMapboxModule(): Promise<typeof import("mapbox-gl")> {
  if (mapboxModule) return mapboxModule;
  if (moduleLoadPromise) return moduleLoadPromise;

  moduleLoadPromise = import("mapbox-gl").then((m) => {
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
    if (mapboxgl) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      const [token, mb] = await Promise.all([fetchMapboxToken(), loadMapboxModule()]);
      if (cancelled) return;
      if (!token) {
        setError("Não foi possível carregar o mapa.");
        setLoading(false);
        return;
      }
      mb.default.accessToken = token;
      setMapboxgl(mb.default);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [mapboxgl]);

  return { mapboxgl, loading, error };
}
