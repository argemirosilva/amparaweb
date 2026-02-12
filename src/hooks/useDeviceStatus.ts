import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveAddress, type GeoResult } from "@/services/reverseGeocodeService";

interface DeviceData {
  status: string;
  bateria_percentual: number | null;
  is_charging: boolean | null;
  dispositivo_info: string | null;
  is_recording: boolean;
  is_monitoring: boolean;
  last_ping_at: string | null;
  panicActive: boolean;
  recordingStartedAt: string | null;
  monitoringStartedAt: string | null;
  panicStartedAt: string | null;
}

interface LocationData {
  latitude: number;
  longitude: number;
  precisao_metros: number | null;
  created_at: string;
}

export interface DeviceStatusResult {
  device: DeviceData | null;
  location: LocationData | null;
  geo: GeoResult | null;
  addressLoading: boolean;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

const POLL_ONLINE = 1_000;
const POLL_OFFLINE = 10_000;

export function useDeviceStatus(): DeviceStatusResult {
  const { usuario } = useAuth();
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const lastGeocodedRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!usuario) return;
    try {
      const [deviceRes, locationRes, panicRes, monitorRes, recordingRes] = await Promise.all([
        supabase
          .from("device_status")
          .select("status, bateria_percentual, is_charging, dispositivo_info, is_recording, is_monitoring, last_ping_at")
          .eq("user_id", usuario.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("localizacoes")
          .select("latitude, longitude, precisao_metros, created_at")
          .eq("user_id", usuario.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("alertas_panico")
          .select("id, criado_em")
          .eq("user_id", usuario.id)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("monitoramento_sessoes")
          .select("iniciado_em")
          .eq("user_id", usuario.id)
          .eq("status", "ativa")
          .order("iniciado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("gravacoes")
          .select("created_at")
          .eq("user_id", usuario.id)
          .eq("status", "pendente")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (deviceRes.error) throw deviceRes.error;
      if (locationRes.error) throw locationRes.error;

      const deviceData = deviceRes.data
        ? {
            ...deviceRes.data,
            panicActive: !!panicRes.data,
            panicStartedAt: panicRes.data?.criado_em ?? null,
            monitoringStartedAt: monitorRes.data?.iniciado_em ?? null,
            recordingStartedAt: recordingRes.data?.created_at ?? null,
          }
        : null;
      setDevice(deviceData);
      setLocation(locationRes.data);
      setError(null);
      setLastFetch(new Date());
    } catch {
      setError("Falha ao carregar status.");
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  // Reverse geocoding via service (dedup + cache + rate-limit built in)
  useEffect(() => {
    if (!location) return;
    const { latitude, longitude } = location;
    // Only re-geocode if lat/lon actually changed (rounded key)
    const coordKey = `${Math.round(latitude * 1e4)},${Math.round(longitude * 1e4)}`;
    if (coordKey === lastGeocodedRef.current) return;

    let cancelled = false;
    setAddressLoading(true);

    resolveAddress(latitude, longitude).then((result) => {
      if (cancelled) return;
      setGeo(result);
      lastGeocodedRef.current = coordKey;
    }).finally(() => {
      if (!cancelled) setAddressLoading(false);
    });

    return () => { cancelled = true; };
  }, [location]);

  // Adaptive polling: 1s when online, 10s when offline
  useEffect(() => {
    fetchData();
    const online = device ? Date.now() - new Date(device.last_ping_at || 0).getTime() < 45_000 : false;
    const interval = online ? POLL_ONLINE : POLL_OFFLINE;
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, device?.last_ping_at]);

  return { device, location, geo, addressLoading, loading, error, lastFetch };
}
