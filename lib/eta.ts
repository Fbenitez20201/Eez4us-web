import type { Trip } from '@prisma/client';
import distance from '@turf/distance';
import { point } from '@turf/helpers';

import { prisma } from './db';
import { getRoute } from './directions';

const RECOMPUTE_MIN_INTERVAL_MS = 30_000;
const DEVIATION_THRESHOLD_METERS = 100;

export interface RecomputeResult {
  trip: Trip;
  etaSeconds: number | null;
  insideGeofence: boolean;
  arrivedFiredNow: boolean;
  recomputed: boolean;
  // true = se intentó recalcular el ETA pero Directions falló (key faltante/ inválida,
  // API no habilitada, throttle de Google). El ping NO se rompe: la posición ya se guardó
  // y el semáforo del portón sigue andando con la última posición; solo el ETA numérico
  // queda con su valor previo. Útil para diagnosticar GOOGLE_MAPS_BACKEND_KEY desde la app.
  etaError?: boolean;
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const km = distance(point([a.lng, a.lat]), point([b.lng, b.lat]), { units: 'kilometers' });
  return km * 1000;
}

export async function recomputeTripEta(tripId: string): Promise<RecomputeResult> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { pickupPoint: true },
  });
  if (!trip) {
    throw new Error('TRIP_NOT_FOUND');
  }
  if (trip.lastLat == null || trip.lastLng == null) {
    return {
      trip,
      etaSeconds: trip.etaSeconds,
      insideGeofence: false,
      arrivedFiredNow: false,
      recomputed: false,
    };
  }

  const current = { lat: trip.lastLat, lng: trip.lastLng };
  const center = { lat: trip.pickupPoint.centerLat, lng: trip.pickupPoint.centerLng };
  const distToPickup = distanceMeters(current, center);
  const insideGeofence = distToPickup <= trip.pickupPoint.radiusMeters;

  let arrivedFiredNow = false;
  if (insideGeofence && !trip.arrivedAt) {
    const now = new Date();
    await prisma.trip.update({
      where: { id: tripId },
      data: { arrivedAt: now, status: 'EN_ZONA', etaSeconds: 0, etaUpdatedAt: now },
    });
    await prisma.tripEvent.create({
      data: {
        tripId,
        type: 'ARRIVED_GEOFENCE',
        metadata: { distanceMeters: distToPickup },
      },
    });
    arrivedFiredNow = true;
    const updated = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: { pickupPoint: true },
    });
    return {
      trip: updated,
      etaSeconds: 0,
      insideGeofence: true,
      arrivedFiredNow,
      recomputed: true,
    };
  }

  const lastEtaAge = trip.etaUpdatedAt ? Date.now() - trip.etaUpdatedAt.getTime() : Infinity;
  const lastCallTooRecent = lastEtaAge < RECOMPUTE_MIN_INTERVAL_MS;
  const driftSmall =
    trip.etaSeconds != null && distToPickup > DEVIATION_THRESHOLD_METERS
      ? false
      : true;

  if (lastCallTooRecent && driftSmall) {
    return {
      trip,
      etaSeconds: trip.etaSeconds,
      insideGeofence,
      arrivedFiredNow: false,
      recomputed: false,
    };
  }

  // Directions es best-effort: si la key no está / la API no está habilitada / Google
  // throttlea, NO tiramos el ping (la telemetría ya se guardó y el semáforo no depende del
  // ETA numérico). Degradamos: dejamos el etaSeconds previo y marcamos etaError.
  let route;
  try {
    route = await getRoute(current, center);
  } catch (err) {
    console.error('[eta] Directions falló, ETA queda con valor previo:', (err as Error).message);
    return {
      trip,
      etaSeconds: trip.etaSeconds,
      insideGeofence,
      // el geofence/arrived no se dispara en esta rama (ya retornó antes si aplicaba).
      arrivedFiredNow: false,
      recomputed: false,
      etaError: true,
    };
  }

  const now = new Date();
  await prisma.trip.update({
    where: { id: tripId },
    data: { etaSeconds: route.durationSeconds, etaUpdatedAt: now },
  });

  const updated = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: { pickupPoint: true },
  });
  return {
    trip: updated,
    etaSeconds: route.durationSeconds,
    insideGeofence,
    arrivedFiredNow,
    recomputed: true,
  };
}
