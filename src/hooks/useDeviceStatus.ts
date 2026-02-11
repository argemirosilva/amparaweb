import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface DeviceData {
  status: string;
  bateria_percentual: number | null;
  is_charging: boolean | null;
  dispositivo_info: string | null;
  is_recording: boolean;
  is_monitoring: boolean;
  last_ping_at: string | null;
}

interface LocationData {
  latitude: number;
  longitude: number;
  precisao_metros: number | null;
  created_at: string;
}

interface GeoCache {
  lat: number;
  lng: number;
  address: string;
  timestamp: number;
}

interface DeviceStatusResult {
  device: DeviceData | null;
  location: LocationData | null;
  address: string | null;
  addressLoading: boolean;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

const POLL_INTERVAL = 30_000;
const GEO_CACHE_TTL = 5 * 60_000;
const DISTANCE_THRESHOLD = 50; // meters

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useDeviceStatus(): DeviceStatusResult {
  const { usuario } = useAuth();
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const geoCacheRef = useRef<GeoCache | null>(null);

  const fetchData = useCallback(async () => {
    if (!usuario) return;
    try {
      const [deviceRes, locationRes] = await Promise.all([
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
      ]);

      if (deviceRes.error) throw deviceRes.error;
      if (locationRes.error) throw locationRes.error;

      setDevice(deviceRes.data);
      setLocation(locationRes.data);
      setError(null);
      setLastFetch(new Date());
    } catch {
      setError("Falha ao carregar status.");
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  // Reverse geocoding with cache
  useEffect(() => {
    if (!location) return;
    const { latitude, longitude } = location;
    const cache = geoCacheRef.current;

    if (cache) {
      const dist = haversineDistance(cache.lat, cache.lng, latitude, longitude);
      const age = Date.now() - cache.timestamp;
      if (dist < DISTANCE_THRESHOLD && age < GEO_CACHE_TTL) {
        setAddress(cache.address);
        return;
      }
    }

    let cancelled = false;
    setAddressLoading(true);
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const addr = data.display_name || null;
        setAddress(addr);
        if (addr) {
          geoCacheRef.current = { lat: latitude, lng: longitude, address: addr, timestamp: Date.now() };
        }
      })
      .catch(() => {
        if (!cancelled) setAddress(null);
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false);
      });

    return () => { cancelled = true; };
  }, [location]);

  // Polling
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  return { device, location, address, addressLoading, loading, error, lastFetch };
}
