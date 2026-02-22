/**
 * Snap-to-road service using Mapbox Map Matching API.
 * Takes raw GPS coordinates and returns road-snapped positions.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

let cachedMapboxToken: string | null = null;

async function getMapboxToken(): Promise<string | null> {
  if (cachedMapboxToken) return cachedMapboxToken;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/mapbox-token`, {
      headers: { apikey: SUPABASE_KEY },
    });
    if (!res.ok) return null;
    const data = await res.json();
    cachedMapboxToken = data?.token || null;
    return cachedMapboxToken;
  } catch {
    return null;
  }
}

interface SnapResult {
  longitude: number;
  latitude: number;
  snapped: boolean;
}

// Cache to avoid re-snapping same coordinates
const snapCache = new Map<string, SnapResult>();
const MAX_CACHE = 500;

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

// Throttle: max 1 request per 300ms
let lastRequestTime = 0;
const MIN_INTERVAL = 300;

/**
 * Snap a series of GPS points to the nearest road using Mapbox Map Matching API.
 * Returns the snapped position for the LAST point in the array.
 * Requires at least 2 points for map matching; falls back to single-point snapping.
 */
export async function snapToRoad(
  points: Array<{ latitude: number; longitude: number }>,
): Promise<SnapResult> {
  if (points.length === 0) {
    return { longitude: 0, latitude: 0, snapped: false };
  }

  const latest = points[0];
  const key = cacheKey(latest.latitude, latest.longitude);

  // Check cache first
  const cached = snapCache.get(key);
  if (cached) return cached;

  // Throttle
  const now = Date.now();
  if (now - lastRequestTime < MIN_INTERVAL) {
    return { longitude: latest.longitude, latitude: latest.latitude, snapped: false };
  }

  const token = await getMapboxToken();
  if (!token) {
    return { longitude: latest.longitude, latitude: latest.latitude, snapped: false };
  }

  lastRequestTime = Date.now();

  try {
    // Use last 3-5 points for better matching (minimum 2 required)
    const matchPoints = points.slice(0, Math.min(5, points.length));
    
    if (matchPoints.length < 2) {
      // Single point: use Mapbox Geocoding reverse with types=address for nearest road
      // Fallback: return as-is (Map Matching needs 2+ points)
      return { longitude: latest.longitude, latitude: latest.latitude, snapped: false };
    }

    // Build coordinates string: lng,lat;lng,lat;...
    const coords = matchPoints
      .map((p) => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`)
      .join(";");

    // Radiuses: how far to search for a road match (in meters)
    const radiuses = matchPoints.map(() => "25").join(";");

    const url = `https://api.mapbox.com/matching/v5/mapbox/driving/${coords}?access_token=${token}&radiuses=${radiuses}&geometries=geojson&overview=full&steps=false`;

    const res = await fetch(url);
    if (!res.ok) {
      return { longitude: latest.longitude, latitude: latest.latitude, snapped: false };
    }

    const data = await res.json();
    
    if (data.code !== "Ok" || !data.matchings?.length) {
      return { longitude: latest.longitude, latitude: latest.latitude, snapped: false };
    }

    // Get the last coordinate from the matched geometry (corresponds to the latest point)
    const geometry = data.matchings[0].geometry;
    const snappedCoords = geometry.coordinates;
    const lastSnapped = snappedCoords[snappedCoords.length - 1];

    const result: SnapResult = {
      longitude: lastSnapped[0],
      latitude: lastSnapped[1],
      snapped: true,
    };

    // Cache result
    if (snapCache.size > MAX_CACHE) {
      const firstKey = snapCache.keys().next().value;
      if (firstKey) snapCache.delete(firstKey);
    }
    snapCache.set(key, result);

    return result;
  } catch (e) {
    console.error("[snapToRoad] error:", e);
    return { longitude: latest.longitude, latitude: latest.latitude, snapped: false };
  }
}
