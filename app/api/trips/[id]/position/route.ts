import { z } from 'zod';

import { prisma } from '@/lib/db';
import { recomputeTripEta } from '@/lib/eta';
import { broadcastRankedTrips, broadcastTripUpdate } from '@/lib/pusher-channels';
import { jsonError, requireRole } from '@/lib/session';

export const runtime = 'edge';

const bodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const { id: tripId } = await params;
    const body = bodySchema.parse(await req.json());

    const existing = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, parentId: true, status: true, schoolId: true, pickupPointId: true },
    });
    if (!existing) {
      return Response.json({ error: 'TRIP_NOT_FOUND' }, { status: 404 });
    }
    if (existing.parentId !== session.user.id) {
      return Response.json({ error: 'NOT_OWNER' }, { status: 403 });
    }
    if (existing.status === 'ENTREGADO' || existing.status === 'CANCELADO') {
      return Response.json({ error: 'TRIP_CLOSED' }, { status: 409 });
    }

    const now = new Date();
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        lastLat: body.lat,
        lastLng: body.lng,
        lastHeadingDeg: body.heading ?? null,
        lastSpeedMps: body.speed ?? null,
        lastPositionAt: now,
      },
    });
    await prisma.tripEvent.create({
      data: {
        tripId,
        type: 'POSITION_UPDATE',
        metadata: {
          lat: body.lat,
          lng: body.lng,
          heading: body.heading ?? null,
          speed: body.speed ?? null,
        },
      },
    });

    const recompute = await recomputeTripEta(tripId);

    await broadcastTripUpdate(tripId);
    if (recompute.arrivedFiredNow) {
      await broadcastRankedTrips(existing.schoolId, existing.pickupPointId);
    } else if (recompute.recomputed) {
      await broadcastRankedTrips(existing.schoolId, existing.pickupPointId);
    }

    return Response.json({
      etaSeconds: recompute.etaSeconds,
      insideGeofence: recompute.insideGeofence,
      arrived: recompute.arrivedFiredNow,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
