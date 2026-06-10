import { z } from 'zod';

import { prisma } from '@/lib/db';
import { broadcastRankedTrips, broadcastTripUpdate } from '@/lib/pusher-channels';
import { jsonError, requireRole } from '@/lib/session';

const bodySchema = z.object({
  status: z.literal('CANCELADO'),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const { id: tripId } = await params;
    const body = bodySchema.parse(await req.json());

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, parentId: true, status: true, schoolId: true, pickupPointId: true },
    });
    if (!trip) {
      return Response.json({ error: 'TRIP_NOT_FOUND' }, { status: 404 });
    }
    if (trip.parentId !== session.user.id) {
      return Response.json({ error: 'NOT_OWNER' }, { status: 403 });
    }
    if (trip.status === 'ENTREGADO') {
      return Response.json({ error: 'ALREADY_DELIVERED' }, { status: 409 });
    }
    if (trip.status === 'CANCELADO') {
      return Response.json({ ok: true });
    }

    const now = new Date();
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: body.status, endedAt: now },
    });
    await prisma.tripEvent.create({
      data: { tripId, type: 'CANCELLED', metadata: { byUserId: session.user.id } },
    });

    await Promise.allSettled([
      broadcastTripUpdate(tripId),
      broadcastRankedTrips(trip.schoolId, trip.pickupPointId),
    ]);

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
