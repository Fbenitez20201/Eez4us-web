import { prisma } from './db';
import { encryptForChannel, readEncryptionMasterKey } from './pusher-encrypt';
import { pusherTrigger, readPusherEnv } from './pusher-server';

export function schoolPickupChannel(schoolId: string, pickupPointId: string): string {
  return `private-encrypted-school-${schoolId}-pickup-${pickupPointId}`;
}

export function tripChannel(tripId: string): string {
  return `private-encrypted-trip-${tripId}`;
}

const STAFF_ROLES = new Set(['director', 'support_staff', 'super_admin']);

export interface AuthorizedSession {
  user: {
    id: string;
    schoolId?: string | null;
    role?: string | null;
  };
}

export async function canAccessChannel(
  channelName: string,
  session: AuthorizedSession,
): Promise<boolean> {
  if (!channelName.startsWith('private-encrypted-')) {
    return false;
  }

  const schoolMatch = channelName.match(/^private-encrypted-school-([^-]+)-pickup-([^-]+)$/);
  if (schoolMatch) {
    const [, schoolId] = schoolMatch;
    if (!STAFF_ROLES.has(session.user.role ?? '')) return false;
    return session.user.schoolId === schoolId;
  }

  const tripMatch = channelName.match(/^private-encrypted-trip-(.+)$/);
  if (tripMatch) {
    const [, tripId] = tripMatch;
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { parentId: true, schoolId: true },
    });
    if (!trip) return false;
    if (trip.parentId === session.user.id) return true;
    if (STAFF_ROLES.has(session.user.role ?? '') && trip.schoolId === session.user.schoolId) {
      return true;
    }
    return false;
  }

  return false;
}

async function publish(channel: string, event: string, payload: unknown): Promise<void> {
  const encrypted = await encryptForChannel(channel, payload, readEncryptionMasterKey());
  const creds = readPusherEnv();
  const res = await pusherTrigger({
    ...creds,
    channel,
    event,
    data: encrypted,
  });
  if (!res.ok) {
    throw new Error(`Pusher trigger ${res.status}: ${await res.text()}`);
  }
}

export interface RankedTrip {
  tripId: string;
  parentId: string;
  parentName: string | null;
  vehicle: { plate: string; model: string; color: string };
  students: Array<{ id: string; firstName: string; lastName: string }>;
  status: string;
  etaSeconds: number | null;
  etaUpdatedAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  arrivedAt: string | null;
}

export async function buildRankedTrips(schoolId: string, pickupPointId: string): Promise<RankedTrip[]> {
  const trips = await prisma.trip.findMany({
    where: {
      schoolId,
      pickupPointId,
      status: { in: ['EN_CAMINO', 'EN_ZONA'] },
    },
    include: {
      parent: { select: { id: true, name: true } },
      vehicle: { select: { plate: true, model: true, color: true } },
      tripStudents: {
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: [{ etaSeconds: 'asc' }, { startedAt: 'asc' }],
  });

  return trips.map((t) => ({
    tripId: t.id,
    parentId: t.parentId,
    parentName: t.parent.name,
    vehicle: t.vehicle,
    students: t.tripStudents.map((ts) => ts.student),
    status: t.status,
    etaSeconds: t.etaSeconds,
    etaUpdatedAt: t.etaUpdatedAt?.toISOString() ?? null,
    lastLat: t.lastLat,
    lastLng: t.lastLng,
    arrivedAt: t.arrivedAt?.toISOString() ?? null,
  }));
}

export async function broadcastRankedTrips(schoolId: string, pickupPointId: string): Promise<void> {
  const ranked = await buildRankedTrips(schoolId, pickupPointId);
  await publish(schoolPickupChannel(schoolId, pickupPointId), 'trips.ranked', { trips: ranked });
}

export interface TripUpdatePayload {
  tripId: string;
  status: string;
  etaSeconds: number | null;
  etaUpdatedAt: string | null;
  lastLat: number | null;
  lastLng: number | null;
  arrivedAt: string | null;
}

export async function broadcastTripUpdate(tripId: string): Promise<void> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      etaSeconds: true,
      etaUpdatedAt: true,
      lastLat: true,
      lastLng: true,
      arrivedAt: true,
    },
  });
  if (!trip) return;
  const payload: TripUpdatePayload = {
    tripId: trip.id,
    status: trip.status,
    etaSeconds: trip.etaSeconds,
    etaUpdatedAt: trip.etaUpdatedAt?.toISOString() ?? null,
    lastLat: trip.lastLat,
    lastLng: trip.lastLng,
    arrivedAt: trip.arrivedAt?.toISOString() ?? null,
  };
  await publish(tripChannel(tripId), 'trip.update', payload);
}
