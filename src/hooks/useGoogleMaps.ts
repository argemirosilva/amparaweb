/// <reference types="google.maps" />
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedKey: string | null = null;
let fetchPromise: Promise<string | null> | null = null;

async function fetchGoogleMapsKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const res = await supabase.functions.invoke("google-maps-key", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error || !res.data?.key) return null;
      cachedKey = res.data.key;
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

// Fetch key for public pages (no auth required) — returns the key from a URL param or public endpoint
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
      // For the tracking page, we fetch the key without auth via a query param approach
      // We'll use a separate public endpoint
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
    const res = await supabase.functions.invoke("google-maps-key-public");
    if (res.error || !res.data?.key) return null;
    cachedKey = res.data.key;
    return cachedKey;
  } catch {
    return null;
  }
}
