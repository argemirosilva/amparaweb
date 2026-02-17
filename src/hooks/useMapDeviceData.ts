import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveAddress, type GeoResult } from "@/services/reverseGeocodeService";

interface MapDeviceData {
  latitude: number;
  longitude: number;
  speed: number | null;
  precisao_metros: number | null;
  created_at: string;
  avatarUrl: string | null;
  firstName: string;
  panicActive: boolean;
  geo: GeoResult | null;
  addressLoading: boolean;
  /** True when device is within 50m of registered home address */
  isHome: boolean;
  /** Registered address components from profile */
  homeAddress: {
    logradouro: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  } | null;
  /** ISO timestamp of when the user arrived at the current location */
  stationarySince: string | null;
}

export interface MapDeviceResult {
  data: MapDeviceData | null;
  loading: boolean;
  error: string | null;
}

const POLL_INTERVAL = 30_000;

/** Haversine distance in meters */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Check if coords are within 50m of home */
function checkIsHome(lat: number, lon: number, endereco_fixo: string | null): boolean {
  if (!endereco_fixo) return false;
  const parts = endereco_fixo.split(",").map((s: string) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return haversineMeters(lat, lon, parts[0], parts[1]) <= 50;
  }
  return false;
}

interface ProfileCache {
  avatarUrl: string | null;
  firstName: string;
  homeAddress: MapDeviceData["homeAddress"];
  endereco_fixo: string | null;
}

/** Preload avatar image into browser cache so marker renders instantly */
function preloadImage(url: string | null) {
  if (!url) return;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
}

export function useMapDeviceData(): MapDeviceResult {
  const { usuario } = useAuth();
  const [data, setData] = useState<MapDeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileRef = useRef<ProfileCache | null>(null);
  const locationHistoryRef = useRef<Array<{ latitude: number; longitude: number; created_at: string }>>([]);

  // Fetch profile once on mount
  useEffect(() => {
    if (!usuario) return;
    (async () => {
      const { data: profile } = await supabase
        .from("usuarios")
        .select("avatar_url, nome_completo, endereco_logradouro, endereco_bairro, endereco_cidade, endereco_uf, endereco_fixo")
        .eq("id", usuario.id)
        .single();
      if (profile) {
        const avatarUrl = profile.avatar_url || usuario.avatar_url || null;
        preloadImage(avatarUrl);
        profileRef.current = {
          avatarUrl,
          firstName: (profile.nome_completo || usuario.nome_completo || "").split(" ")[0],
          homeAddress: {
            logradouro: profile.endereco_logradouro,
            bairro: profile.endereco_bairro,
            cidade: profile.endereco_cidade,
            uf: profile.endereco_uf,
          },
          endereco_fixo: profile.endereco_fixo,
        };
      }
    })();
  }, [usuario]);

  // Calculate stationarySince from local history
  const calcStationarySince = useCallback((lat: number, lon: number, created_at: string): string | null => {
    const history = locationHistoryRef.current;
    let since = created_at;
    for (const h of history) {
      if (haversineMeters(lat, lon, h.latitude, h.longitude) <= 100) {
        since = h.created_at;
      } else {
        break;
      }
    }
    return since !== created_at ? since : null;
  }, []);

  // Apply a location update (from initial fetch or realtime payload)
  const applyLocation = useCallback((loc: { latitude: number; longitude: number; speed: number | null; precisao_metros: number | null; created_at: string }, isPanic: boolean) => {
    const profile = profileRef.current;
    const isHome = checkIsHome(loc.latitude, loc.longitude, profile?.endereco_fixo ?? null);
    const stationarySince = calcStationarySince(loc.latitude, loc.longitude, loc.created_at);

    // Instantly update coords (geo will follow async)
    setData(prev => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: loc.speed,
      precisao_metros: loc.precisao_metros,
      created_at: loc.created_at,
      avatarUrl: profile?.avatarUrl ?? prev?.avatarUrl ?? null,
      firstName: profile?.firstName ?? prev?.firstName ?? "",
      panicActive: isPanic,
      geo: prev?.geo ?? null,
      addressLoading: true,
      isHome,
      homeAddress: profile?.homeAddress ?? prev?.homeAddress ?? null,
      stationarySince,
    }));

    // Resolve address asynchronously
    resolveAddress(loc.latitude, loc.longitude).then(geo => {
      setData(prev => prev ? { ...prev, geo, addressLoading: false } : prev);
    });
  }, [calcStationarySince]);

  // Initial fetch + polling fallback
  const fetchData = useCallback(async () => {
    if (!usuario) return;
    try {
      const [locRes, locHistoryRes, panicRes] = await Promise.all([
        supabase
          .from("localizacoes")
          .select("latitude, longitude, speed, precisao_metros, created_at")
          .eq("user_id", usuario.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("localizacoes")
          .select("latitude, longitude, created_at")
          .eq("user_id", usuario.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("alertas_panico")
          .select("id")
          .eq("user_id", usuario.id)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle(),
      ]);

      if (locRes.error) throw locRes.error;
      if (!locRes.data) {
        setData(null);
        setError("Nenhuma localização encontrada.");
        setLoading(false);
        return;
      }

      // Cache location history for incremental stationarySince
      locationHistoryRef.current = locHistoryRes.data || [];

      applyLocation(locRes.data, !!panicRes.data);
      setError(null);
    } catch {
      setError("Falha ao carregar dados do mapa.");
    } finally {
      setLoading(false);
    }
  }, [usuario, applyLocation]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  // Realtime: use payload directly for locations, re-fetch for panic changes
  useEffect(() => {
    if (!usuario) return;

    const channel = supabase
      .channel(`map-data-${usuario.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alertas_panico", filter: `user_id=eq.${usuario.id}` },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "localizacoes", filter: `user_id=eq.${usuario.id}` },
        (payload) => {
          const d = payload.new as any;
          const loc = {
            latitude: d.latitude as number,
            longitude: d.longitude as number,
            speed: d.speed as number | null,
            precisao_metros: d.precisao_metros as number | null,
            created_at: d.created_at as string,
          };

          // Prepend to local history for stationarySince calculation
          locationHistoryRef.current = [
            { latitude: loc.latitude, longitude: loc.longitude, created_at: loc.created_at },
            ...locationHistoryRef.current,
          ].slice(0, 50);

          // Use current panic state from existing data
          const isPanic = data?.panicActive ?? false;
          applyLocation(loc, isPanic);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuario, fetchData, applyLocation, data?.panicActive]);

  return { data, loading, error };
}
