import { getCacheKV } from './cf-env';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string | null;
  cached: boolean;
  fetchedAt: number;
}

const CACHE_TTL_SECONDS = 60;

function cacheKey(o: LatLng, d: LatLng): string {
  const r = (n: number) => n.toFixed(5);
  return `directions:${r(o.lat)},${r(o.lng)}->${r(d.lat)},${r(d.lng)}`;
}

export async function getRoute(origin: LatLng, dest: LatLng): Promise<RouteResult> {
  const kv = await getCacheKV();
  const key = cacheKey(origin, dest);

  if (kv) {
    const hit = await kv.get(key, 'json');
    if (hit && typeof hit === 'object') {
      return { ...(hit as RouteResult), cached: true };
    }
  }

  const apiKey = process.env.GOOGLE_MAPS_BACKEND_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_BACKEND_KEY no configurado');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  url.searchParams.set('destination', `${dest.lat},${dest.lng}`);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('departure_time', 'now');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Directions API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    status: string;
    routes: Array<{
      legs: Array<{
        distance?: { value: number };
        duration_in_traffic?: { value: number };
        duration?: { value: number };
      }>;
      overview_polyline?: { points: string };
    }>;
  };

  if (json.status !== 'OK' || !json.routes[0]) {
    throw new Error(`Directions API status=${json.status}`);
  }

  const leg = json.routes[0].legs[0];
  const result: RouteResult = {
    distanceMeters: leg?.distance?.value ?? 0,
    durationSeconds: leg?.duration_in_traffic?.value ?? leg?.duration?.value ?? 0,
    polyline: json.routes[0].overview_polyline?.points ?? null,
    cached: false,
    fetchedAt: Date.now(),
  };

  if (kv) {
    await kv.put(key, JSON.stringify(result), { expirationTtl: CACHE_TTL_SECONDS });
  }

  return result;
}
