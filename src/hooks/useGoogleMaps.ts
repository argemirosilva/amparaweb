/// <reference types="google.maps" />
import { useState, useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let cachedKey: string | null = null;
let fetchPromise: Promise<string | null> | null = null;

async function fetchGoogleMapsKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const sessionToken = localStorage.getItem("ampara_session_token");
      if (!sessionToken) return null;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/google-maps-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ session_token: sessionToken }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.key) return null;
      cachedKey = data.key;
      return cachedKey;
    } catch {
      return null;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

let loadPromise: Promise<typeof google.maps> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<typeof google.maps> {
  if (loadPromise) return loadPromise;
  if (typeof google !== "undefined" && google.maps) {
    return Promise.resolve(google.maps);
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(google.maps);
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function useGoogleMaps() {
  const [maps, setMaps] = useState<typeof google.maps | null>(
    typeof google !== "undefined" && google.maps ? google.maps : null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!maps);

  useEffect(() => {
    if (maps) return;

    let cancelled = false;
    (async () => {
      const key = await fetchGoogleMapsKey();
      if (cancelled) return;
      if (!key) {
        setError("Não foi possível carregar o mapa.");
        setLoading(false);
        return;
      }
      try {
        const m = await loadGoogleMapsScript(key);
        if (!cancelled) { setMaps(m); setLoading(false); }
      } catch {
        if (!cancelled) { setError("Falha ao carregar Google Maps."); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [maps]);

  return { maps, loading, error };
}

// Public version for tracking page (no auth needed)
export function useGoogleMapsPublic() {
  const [maps, setMaps] = useState<typeof google.maps | null>(
    typeof google !== "undefined" && google.maps ? google.maps : null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!maps);

  useEffect(() => {
    if (maps) return;

    let cancelled = false;
    (async () => {
      const key = await fetchGoogleMapsKeyPublic();
      if (cancelled) return;
      if (!key) {
        setError("Não foi possível carregar o mapa.");
        setLoading(false);
        return;
      }
      try {
        const m = await loadGoogleMapsScript(key);
        if (!cancelled) { setMaps(m); setLoading(false); }
      } catch {
        if (!cancelled) { setError("Falha ao carregar Google Maps."); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [maps]);

  return { maps, loading, error };
}

async function fetchGoogleMapsKeyPublic(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/google-maps-key-public`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.key) return null;
    cachedKey = data.key;
    return cachedKey;
  } catch {
    return null;
  }
}
