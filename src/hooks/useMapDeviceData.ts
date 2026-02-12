import { useState, useEffect, useCallback } from "react";
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

export function useMapDeviceData(): MapDeviceResult {
  const { usuario } = useAuth();
  const [data, setData] = useState<MapDeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!usuario) return;
    try {
      const [locRes, panicRes, profileRes] = await Promise.all([
        supabase
          .from("localizacoes")
          .select("latitude, longitude, speed, precisao_metros, created_at")
          .eq("user_id", usuario.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("alertas_panico")
          .select("id")
          .eq("user_id", usuario.id)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("usuarios")
          .select("avatar_url, nome_completo, endereco_logradouro, endereco_bairro, endereco_cidade, endereco_uf, endereco_fixo")
          .eq("id", usuario.id)
          .single(),
      ]);

      if (locRes.error) throw locRes.error;
      if (!locRes.data) {
        setData(null);
        setError("Nenhuma localização encontrada.");
        setLoading(false);
        return;
      }

      const loc = locRes.data;
      const profile = profileRes.data;
      const firstName = (profile?.nome_completo || usuario.nome_completo || "").split(" ")[0];
      const avatarUrl = profile?.avatar_url || usuario.avatar_url || null;
      const panicActive = !!panicRes.data;

      // Home address coordinates — we geocode the registered fixed address
      // For "Em Casa" we compare current coords against endereco_fixo
      // endereco_fixo stores "lat,lon" or a text address. We'll use a simpler approach:
      // Check if user has a registered address and reverse-geocode current position
      const homeAddress = profile ? {
        logradouro: profile.endereco_logradouro,
        bairro: profile.endereco_bairro,
        cidade: profile.endereco_cidade,
        uf: profile.endereco_uf,
      } : null;

      // Resolve current address
      const geo = await resolveAddress(loc.latitude, loc.longitude);

      // Check "Em Casa": if endereco_fixo contains coords "lat,lon" we can compare
      let isHome = false;
      if (profile?.endereco_fixo) {
        const parts = profile.endereco_fixo.split(",").map((s: string) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          const dist = haversineMeters(loc.latitude, loc.longitude, parts[0], parts[1]);
          isHome = dist <= 50;
        }
      }

      setData({
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed,
        precisao_metros: loc.precisao_metros,
        created_at: loc.created_at,
        avatarUrl,
        firstName,
        panicActive,
        geo,
        addressLoading: false,
        isHome,
        homeAddress,
      });
      setError(null);
    } catch {
      setError("Falha ao carregar dados do mapa.");
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  // Realtime: re-fetch on panic or location changes
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
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuario, fetchData]);

  return { data, loading, error };
}
