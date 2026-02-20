/**
 * AMPARA COPOM Data Collection Service
 * Collects, validates, and structures data for COPOM emergency communication.
 * Privacy-first: no CPF/RG, full address, full phone, full email.
 */

import { supabase } from "@/integrations/supabase/client";
import { resolveAddress } from "@/services/reverseGeocodeService";

// ── Types ──────────────────────────────────────────────

export interface CopomContextPayload {
  type: "COPOM_ALERT_CONTEXT";
  protocol_id: string;
  timestamp: string;
  risk_level: string;
  trigger_reason: string;
  victim: {
    name: string | null;
    internal_id: string | null;
    phone_masked: string | null;
  };
  location: {
    address: string | null;
    lat: number | null;
    lng: number | null;
    accuracy_m: number | null;
    movement_status: string;
    speed_kmh: number | null;
  };
  monitoring_link: string;
  aggressor: {
    name: string | null;
    name_masked: string | null;
    description: string | null;
    vehicle: {
      model: string | null;
      color: string | null;
      plate_partial: string | null;
    };
    vehicle_note: "NAO_CONFIRMADO";
  };
  victim_aggressor_relation: string | null;
  strict_rules: {
    never_invent_data: true;
    if_missing_say_unavailable: true;
    do_not_claim_certainty: true;
    privacy_first: true;
  };
}

export interface CopomUpdatePayload {
  type: "COPOM_ALERT_UPDATE";
  protocol_id: string;
  timestamp: string;
  location: {
    address: string | null;
    lat: number | null;
    lng: number | null;
    accuracy_m: number | null;
    movement_status: string;
    speed_kmh: number | null;
  };
}

export interface CopomValidationResult {
  valid: boolean;
  errors: string[];
  context: CopomContextPayload | null;
}

// ── Helpers ────────────────────────────────────────────

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const ddd = digits.slice(0, 2);
  const last4 = digits.slice(-4);
  return `(${ddd}) ****-${last4}`;
}

function classifyMovement(speed: number | null): string {
  if (speed === null || speed === undefined) return "DESCONHECIDO";
  if (speed < 1) return "PARADA";
  if (speed < 8) return "CAMINHANDO";
  return "VEICULO";
}

/**
 * Strip city, state and CEP from a display address, keeping only
 * the basic street/neighborhood info for voice synthesis clarity.
 * Input:  "Rua Augusta, Consolação, São Paulo - SP"
 * Output: "Rua Augusta, Consolação"
 */
function stripCityState(address: string | null): string | null {
  if (!address) return null;
  // Remove " - UF" suffix (e.g. " - SP")
  let basic = address.replace(/\s*-\s*[A-Z]{2}$/, "");
  // Remove last segment if it looks like a city (after stripping state)
  // The format is "road, suburb, city" — remove the last comma-separated part
  const parts = basic.split(",").map(p => p.trim());
  if (parts.length >= 3) {
    // Keep all but the last part (city)
    basic = parts.slice(0, -1).join(", ");
  }
  return basic;
}

// ── Core ───────────────────────────────────────────────

export async function collectCopomData(
  userId: string,
  panicAlertId?: string
): Promise<CopomValidationResult> {
  const errors: string[] = [];

  // 1. Fetch panic alert (protocol, risk, trigger)
  let alertData: any = null;
  if (panicAlertId) {
    const { data } = await supabase
      .from("alertas_panico")
      .select("id, protocolo, status, criado_em, tipo_acionamento, latitude, longitude")
      .eq("id", panicAlertId)
      .eq("user_id", userId)
      .maybeSingle();
    alertData = data;
  } else {
    // Get most recent active alert
    const { data } = await supabase
      .from("alertas_panico")
      .select("id, protocolo, status, criado_em, tipo_acionamento, latitude, longitude")
      .eq("user_id", userId)
      .eq("status", "ativo")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    alertData = data;
  }

  // 2. Fetch user profile (victim data)
  const { data: user } = await supabase
    .from("usuarios")
    .select("id, nome_completo, telefone")
    .eq("id", userId)
    .single();

  // 3. Fetch latest location
  const { data: loc } = await supabase
    .from("localizacoes")
    .select("latitude, longitude, precisao_metros, speed, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4. Fetch linked aggressor (if any)
  const { data: vinculo } = await supabase
    .from("vitimas_agressores")
    .select("agressor_id, tipo_vinculo, status_relacao")
    .eq("usuario_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let agressorData: any = null;
  if (vinculo?.agressor_id) {
    const { data } = await supabase
      .from("agressores")
      .select("nome, display_name_masked, vehicles, risk_level")
      .eq("id", vinculo.agressor_id)
      .single();
    agressorData = data;
  }

  // 5. Fetch GPS sharing link
  const { data: share } = await supabase
    .from("compartilhamento_gps")
    .select("codigo")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 6. Resolve address
  let addressResolved: string | null = null;
  const lat = loc?.latitude ?? alertData?.latitude ?? null;
  const lng = loc?.longitude ?? alertData?.longitude ?? null;

  if (lat !== null && lng !== null) {
    try {
      const geo = await resolveAddress(lat, lng);
      addressResolved = geo.display_address !== "Endereço indisponível" ? geo.display_address : null;
    } catch {
      // fallback: no address
    }
  }

  // 7. Build protocol & monitoring link
  const protocolId = alertData?.protocolo ?? null;
  const timestamp = alertData?.criado_em ?? new Date().toISOString();
  const monitoringLink = share?.codigo
    ? `${window.location.origin}/${share.codigo}`
    : null;

  // 8. Movement classification
  const speedKmh = loc?.speed != null ? Math.round(loc.speed * 3.6) : null;
  const movementStatus = classifyMovement(speedKmh);

  // 9. Aggressor vehicle data
  const vehicles = agressorData?.vehicles;
  const firstVehicle = Array.isArray(vehicles) && vehicles.length > 0 ? vehicles[0] : null;

  // 10. Build description for aggressor
  let agressorDesc: string | null = null;
  if (vinculo) {
    const parts: string[] = [];
    if (vinculo.tipo_vinculo) parts.push(vinculo.tipo_vinculo);
    if (vinculo.status_relacao) parts.push(vinculo.status_relacao);
    if (agressorData?.risk_level) parts.push(`risco: ${agressorData.risk_level}`);
    agressorDesc = parts.length > 0 ? parts.join(", ") : null;
  }

  // ── Validation ──

  if (!protocolId) errors.push("protocol_id ausente");
  if (!timestamp) errors.push("timestamp ausente");
  if (!monitoringLink) errors.push("monitoring_link ausente");
  if (!movementStatus || movementStatus === "DESCONHECIDO") {
    // movement_status is required but we can default
  }
  if (!addressResolved && (lat === null || lng === null)) {
    errors.push("localização ausente (nem endereço nem coordenadas)");
  }

  if (errors.length > 0) {
    console.error("COPOM ABORTADO: dados mínimos ausentes", errors);
    return { valid: false, errors, context: null };
  }

  const context: CopomContextPayload = {
    type: "COPOM_ALERT_CONTEXT",
    protocol_id: protocolId!,
    timestamp,
    risk_level: agressorData?.risk_level?.toUpperCase() ?? "ALTO",
    trigger_reason: alertData?.tipo_acionamento ?? "panico_manual",
    victim: {
      name: user?.nome_completo ?? null,
      internal_id: userId,
      phone_masked: maskPhone(user?.telefone ?? null),
    },
    location: {
      address: stripCityState(addressResolved),
      lat,
      lng,
      accuracy_m: loc?.precisao_metros ?? null,
      movement_status: movementStatus,
      speed_kmh: speedKmh,
    },
    monitoring_link: monitoringLink!,
    victim_aggressor_relation: vinculo?.tipo_vinculo ?? null,
    aggressor: {
      name: agressorData?.nome ?? null,
      name_masked: agressorData?.display_name_masked ?? null,
      description: agressorDesc,
      vehicle: {
        model: firstVehicle?.model_hint ?? null,
        color: firstVehicle?.color ?? null,
        plate_partial: firstVehicle?.plate_partial ?? firstVehicle?.plate_prefix ?? null,
      },
      vehicle_note: "NAO_CONFIRMADO",
    },
    strict_rules: {
      never_invent_data: true,
      if_missing_say_unavailable: true,
      do_not_claim_certainty: true,
      privacy_first: true,
    },
  };

  return { valid: true, errors: [], context };
}

/**
 * Collect updated location data for real-time COPOM updates.
 */
export async function collectCopomLocationUpdate(
  userId: string,
  protocolId: string
): Promise<CopomUpdatePayload | null> {
  const { data: loc } = await supabase
    .from("localizacoes")
    .select("latitude, longitude, precisao_metros, speed, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!loc) return null;

  let addressResolved: string | null = null;
  try {
    const geo = await resolveAddress(loc.latitude, loc.longitude);
    addressResolved = geo.display_address !== "Endereço indisponível" ? geo.display_address : null;
  } catch {
    // no address
  }

  const speedKmh = loc.speed != null ? Math.round(loc.speed * 3.6) : null;

  return {
    type: "COPOM_ALERT_UPDATE",
    protocol_id: protocolId,
    timestamp: new Date().toISOString(),
    location: {
      address: stripCityState(addressResolved),
      lat: loc.latitude,
      lng: loc.longitude,
      accuracy_m: loc.precisao_metros,
      movement_status: classifyMovement(speedKmh),
      speed_kmh: speedKmh,
    },
  };
}
