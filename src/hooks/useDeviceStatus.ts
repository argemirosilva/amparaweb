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
  updated_at: string | null;
  panicActive: boolean;
  panicShareCode: string | null;
  recordingStartedAt: string | null;
  monitoringStartedAt: string | null;
  panicStartedAt: string | null;
  lastSegmentIdx: number | null;
  origem: string | null;
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
  locationInterval: number | null;
  geo: GeoResult | null;
  addressLoading: boolean;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

export function useDeviceStatus(): DeviceStatusResult {
  const { usuario } = useAuth();
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationInterval, setLocationInterval] = useState<number | null>(null);
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const lastGeocodedRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!usuario) return;
    try {
      const [deviceRes, locationRes, panicRes, monitorRes, recordingRes, segmentRes, gpsShareRes] = await Promise.all([
        supabase
          .from("device_status")
          .select("status, bateria_percentual, is_charging, dispositivo_info, is_recording, is_monitoring, last_ping_at, updated_at")
          .eq("user_id", usuario.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("localizacoes")
          .select("latitude, longitude, precisao_metros, created_at")
          .eq("user_id", usuario.id)
          .order("created_at", { ascending: false })
          .limit(2),
        supabase
          .from("alertas_panico")
          .select("id, criado_em")
          .eq("user_id", usuario.id)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("monitoramento_sessoes")
          .select("iniciado_em, origem")
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
        supabase
          .from("gravacoes_segmentos")
          .select("segmento_idx")
          .eq("user_id", usuario.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("compartilhamento_gps")
          .select("codigo")
          .eq("user_id", usuario.id)
          .eq("ativo", true)
          .eq("tipo", "panico")
          .gte("expira_em", new Date().toISOString())
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (deviceRes.error) throw deviceRes.error;
      if (locationRes.error) throw locationRes.error;

      const locations = locationRes.data ?? [];
      const latestLocation = locations[0] ?? null;
      const interval = locations.length >= 2
        ? Math.round((new Date(locations[0].created_at).getTime() - new Date(locations[1].created_at).getTime()) / 1000)
        : null;

      // Derive actual states from multiple sources for accuracy
      // If device says recording but no pending gravacao exists, it already stopped
      const hasPendingRecording = !!recordingRes.data;
      const hasActiveMonitor = !!monitorRes.data;
      const hasActivePanic = !!panicRes.data;

      const deviceData = deviceRes.data
        ? {
            ...deviceRes.data,
            // Trust device flags, but override to FALSE only when DB confirms activity ended.
            // Recording is valid if there's a pending gravacao OR an active monitoring session.
            is_recording: deviceRes.data.is_recording && !hasPendingRecording && !hasActiveMonitor ? false : deviceRes.data.is_recording,
            is_monitoring: deviceRes.data.is_monitoring && hasActiveMonitor,
            panicActive: hasActivePanic,
            panicShareCode: gpsShareRes.data?.codigo ?? null,
            panicStartedAt: panicRes.data?.criado_em ?? null,
            monitoringStartedAt: monitorRes.data?.iniciado_em ?? null,
            recordingStartedAt: recordingRes.data?.created_at ?? monitorRes.data?.iniciado_em ?? null,
            lastSegmentIdx: segmentRes.data?.segmento_idx ?? null,
            origem: monitorRes.data?.origem ?? null,
          }
        : null;
      setDevice(deviceData);
      setLocation(latestLocation);
      setLocationInterval(interval);
      setError(null);
      setLastFetch(new Date());
    } catch {
      setError("Falha ao carregar status.");
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  // Reverse geocoding
  useEffect(() => {
    if (!location) return;
    const { latitude, longitude } = location;
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

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when tab becomes visible (handles silent Realtime disconnects)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchData]);

  // Realtime subscriptions — re-fetch on any relevant change
  useEffect(() => {
    if (!usuario) return;

    const subscribe = () =>
      supabase
        .channel(`device-status-${usuario.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "device_status", filter: `user_id=eq.${usuario.id}` },
          () => fetchData()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "alertas_panico", filter: `user_id=eq.${usuario.id}` },
          () => fetchData()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "monitoramento_sessoes", filter: `user_id=eq.${usuario.id}` },
          () => fetchData()
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "localizacoes", filter: `user_id=eq.${usuario.id}` },
          () => fetchData()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "gravacoes", filter: `user_id=eq.${usuario.id}` },
          () => fetchData()
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "gravacoes_segmentos", filter: `user_id=eq.${usuario.id}` },
          () => fetchData()
        )
        .subscribe();

    let channel = subscribe();

    // Re-subscribe when tab comes back (Realtime may have silently disconnected)
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        supabase.removeChannel(channel);
        channel = subscribe();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
    };
  }, [usuario, fetchData]);

  // Adaptive polling: 1s active, 5s idle
  const isActive = !!(device?.is_recording || device?.is_monitoring || device?.panicActive);
  useEffect(() => {
    const interval = isActive ? 1_000 : 5_000;
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [fetchData, isActive]);

  return { device, location, locationInterval, geo, addressLoading, loading, error, lastFetch };
}
