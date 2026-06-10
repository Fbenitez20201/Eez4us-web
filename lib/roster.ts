import { Prisma } from '@prisma/client';
import distance from '@turf/distance';
import { point } from '@turf/helpers';

import { prisma } from './db';
import type { RosterEntry, RosterProximity } from './trip-types';

// Roles que operan el portón desde el mobile: la "miss" (logistics) + staff de la
// escuela. NO incluye parent ni vendor.
export const GATE_ROLES = ['logistics', 'support_staff', 'director', 'super_admin'];

export type { RosterEntry, RosterProximity };

// Umbrales del semáforo. EN_PUERTA = dentro del geofence (mismo criterio que el
// backend de ETA: turf.distance Haversine, NO Google). CERCA = a un par de radios
// o con ETA corto. Lo demás, EN_CAMINO.
const NEAR_RADIUS_FACTOR = 3;
const NEAR_ETA_SECONDS = 120;

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return distance(point([a.lng, a.lat]), point([b.lng, b.lat]), { units: 'kilometers' }) * 1000;
}

interface PickupGeo {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

interface ProximityInput {
  status: string;
  arrivedAt: Date | null;
  lastLat: number | null;
  lastLng: number | null;
  etaSeconds: number | null;
}

export function computeProximity(
  trip: ProximityInput,
  pickup: PickupGeo,
): { proximity: RosterProximity; atGate: boolean } {
  const inZoneByState = trip.status === 'EN_ZONA' || trip.arrivedAt != null;
  let dist: number | null = null;
  if (trip.lastLat != null && trip.lastLng != null) {
    dist = distanceMeters(
      { lat: trip.lastLat, lng: trip.lastLng },
      { lat: pickup.centerLat, lng: pickup.centerLng },
    );
  }
  const insideGeofence = dist != null && dist <= pickup.radiusMeters;
  if (inZoneByState || insideGeofence) {
    return { proximity: 'EN_PUERTA', atGate: true };
  }
  const near =
    (dist != null && dist <= pickup.radiusMeters * NEAR_RADIUS_FACTOR) ||
    (trip.etaSeconds != null && trip.etaSeconds <= NEAR_ETA_SECONDS);
  return { proximity: near ? 'CERCA' : 'EN_CAMINO', atGate: false };
}

const rosterTripInclude = {
  parent: { select: { name: true } },
  vehicle: { select: { plate: true, model: true, color: true } },
  authorizedFamily: { select: { fullName: true, relationship: true } },
  pickupPoint: { select: { centerLat: true, centerLng: true, radiusMeters: true } },
  // Solo alumnos pendientes: los ya entregados (deliveredAt) salen del roster y del
  // semáforo. Un viaje con un hermano entregado sigue mostrando al que falta.
  tripStudents: {
    where: { deliveredAt: null },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.TripInclude;

export type RosterTrip = Prisma.TripGetPayload<{ include: typeof rosterTripInclude }>;

function pickupByOf(trip: RosterTrip): RosterEntry['pickupBy'] {
  if (trip.isWalkup) {
    return { kind: 'walkup', name: 'Retiro en puerta', relationship: null };
  }
  if (trip.authorizedFamily) {
    return {
      kind: 'authorized-family',
      name: trip.authorizedFamily.fullName,
      relationship: trip.authorizedFamily.relationship,
    };
  }
  return { kind: 'parent', name: trip.parent.name ?? 'Representante', relationship: null };
}

// Un trip puede atar a varios hermanos (TripStudent[]). El contrato del mobile usa
// `student` singular, así que aplanamos: una entry por alumno pendiente, mismo tripId.
// La entrega (deliver) es POR-ALUMNO: cada hermano se suelta por separado.
export function tripToRosterEntries(trip: RosterTrip): RosterEntry[] {
  const { proximity, atGate } = computeProximity(trip, trip.pickupPoint);
  const pickupBy = pickupByOf(trip);
  const vehicle = trip.vehicle
    ? { plate: trip.vehicle.plate, model: trip.vehicle.model, color: trip.vehicle.color }
    : null;
  return trip.tripStudents.map((ts) => ({
    tripId: trip.id,
    origin: trip.origin,
    student: {
      id: ts.student.id,
      firstName: ts.student.firstName,
      lastName: ts.student.lastName,
      grade: ts.student.grade ?? null,
    },
    pickupBy,
    vehicle,
    etaSeconds: trip.etaSeconds,
    proximity,
    atGate,
  }));
}

export async function getPickupRoster(
  schoolId: string,
  pickupPointId: string,
): Promise<RosterEntry[]> {
  const trips = await prisma.trip.findMany({
    where: { schoolId, pickupPointId, status: { in: ['EN_CAMINO', 'EN_ZONA'] } },
    include: rosterTripInclude,
    orderBy: [{ etaSeconds: 'asc' }, { startedAt: 'asc' }],
  });
  return trips.flatMap(tripToRosterEntries);
}

// Resuelve la tarjeta QR fija (token → studentId) a la recogida activa y autorizada AHORA
// de ese alumno. Devuelve la entry de ESE alumno + las de los hermanos pendientes del MISMO
// viaje (un solo escaneo basta para liberar al grupo; la entrega sigue siendo por-alumno).
// null = sin viaje activo. Desempate si hay varias: la del pickup point del escáner, sino
// la más reciente.
export async function resolveActiveEntriesForStudent(
  schoolId: string,
  studentId: string,
  pickupPointId?: string,
): Promise<{ entry: RosterEntry; groupedEntries: RosterEntry[] } | null> {
  const trips = await prisma.trip.findMany({
    where: {
      schoolId,
      status: { in: ['EN_CAMINO', 'EN_ZONA'] },
      tripStudents: { some: { studentId, deliveredAt: null } },
    },
    include: rosterTripInclude,
    orderBy: { startedAt: 'desc' },
  });
  if (trips.length === 0) return null;
  const trip = (pickupPointId && trips.find((t) => t.pickupPointId === pickupPointId)) || trips[0];
  // rosterTripInclude ya filtra entregados, así que la entry del alumno está presente.
  const groupedEntries = tripToRosterEntries(trip);
  const entry = groupedEntries.find((e) => e.student.id === studentId);
  if (!entry) return null;
  return { entry, groupedEntries };
}


export type WalkupResult =
  | { ok: true; entry: RosterEntry }
  | { ok: false; error: 'STUDENT_NOT_FOUND' | 'STUDENT_INACTIVE' | 'STUDENT_HAS_NO_PARENT' };

// Walk-up puro (§A7-ter): alguien llega a la puerta con la tarjeta del alumno sin que el
// padre haya arrancado viaje. Creamos un Trip SINTÉTICO (isWalkup, sin vehículo ni GPS, ya
// EN_ZONA en la puerta) para reusar toda la maquinaria de entrega por-alumno / historial /
// broadcast / atribución. El parentId es el del alumno (para el push de entrega y la
// atribución); se excluye de los flujos del padre vía isWalkup. Idempotente desde el lado
// del verify: un segundo escaneo encuentra este viaje vía resolveActiveEntryForStudent.
export async function createWalkupEntry(params: {
  schoolId: string;
  studentId: string;
  pickupPointId: string;
  byUserId: string;
}): Promise<WalkupResult> {
  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: {
      id: true,
      schoolId: true,
      active: true,
      parents: { select: { parentId: true }, take: 1 },
    },
  });
  if (!student || student.schoolId !== params.schoolId) {
    return { ok: false, error: 'STUDENT_NOT_FOUND' };
  }
  if (!student.active) {
    return { ok: false, error: 'STUDENT_INACTIVE' };
  }
  const parentId = student.parents[0]?.parentId;
  if (!parentId) {
    return { ok: false, error: 'STUDENT_HAS_NO_PARENT' };
  }

  const trip = await prisma.trip.create({
    data: {
      schoolId: params.schoolId,
      pickupPointId: params.pickupPointId,
      parentId,
      vehicleId: null,
      isWalkup: true,
      origin: 'WALKUP',
      status: 'EN_ZONA',
      arrivedAt: new Date(),
      tripStudents: { create: { studentId: params.studentId } },
      events: { create: { type: 'STARTED', metadata: { walkup: true, byUserId: params.byUserId } } },
    },
    include: rosterTripInclude,
  });

  const entry = tripToRosterEntries(trip).find((e) => e.student.id === params.studentId);
  if (!entry) {
    // No debería pasar: el alumno recién creado está pendiente. Defensivo.
    return { ok: false, error: 'STUDENT_NOT_FOUND' };
  }
  return { ok: true, entry };
}
