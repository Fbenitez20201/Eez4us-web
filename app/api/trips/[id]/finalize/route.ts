import { prisma } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';
import { broadcastRankedTrips, broadcastTripUpdate } from '@/lib/pusher-channels';
import { jsonError, requireRole } from '@/lib/session';

const ALLOWED_ROLES = ['support_staff', 'director', 'super_admin'];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ALLOWED_ROLES);
    const { id: tripId } = await params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, schoolId: true, pickupPointId: true, status: true, parentId: true },
    });
    if (!trip) {
      return Response.json({ error: 'TRIP_NOT_FOUND' }, { status: 404 });
    }
    if (trip.schoolId !== session.user.schoolId) {
      return Response.json({ error: 'FORBIDDEN_SCHOOL' }, { status: 403 });
    }
    if (trip.status === 'ENTREGADO') {
      return Response.json({ error: 'ALREADY_DELIVERED' }, { status: 409 });
    }
    if (trip.status === 'CANCELADO') {
      return Response.json({ error: 'TRIP_CANCELED' }, { status: 409 });
    }

    const now = new Date();
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        status: 'ENTREGADO',
        deliveredAt: now,
        endedAt: now,
        finalizedByUserId: session.user.id,
      },
    });
    await prisma.tripEvent.create({
      data: { tripId, type: 'DELIVERED_MANUAL', metadata: { byUserId: session.user.id } },
    });

    await Promise.allSettled([
      broadcastTripUpdate(tripId),
      broadcastRankedTrips(trip.schoolId, trip.pickupPointId),
      sendPushToUser(trip.parentId, {
        title: 'Entrega completada',
        body: 'Tu hijo fue entregado',
        data: { type: 'trip-delivered', tripId },
      }),
    ]);

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
