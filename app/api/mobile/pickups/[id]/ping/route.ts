import { z } from 'zod';

import { prisma } from '@/lib/db';
import { recomputeTripEta } from '@/lib/eta';
import { sendPushToUser } from '@/lib/push';
import { broadcastRankedTrips, broadcastTripUpdate } from '@/lib/pusher-channels';
import { jsonError, requireRole } from '@/lib/session';

const schema = z.object({
  lat: z.number(),
  lng: z.number(),
  speed: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  timestamp: z.string().datetime().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip || trip.parentId !== session.user.id) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (trip.status !== 'EN_CAMINO' && trip.status !== 'EN_ZONA') {
      return Response.json({ error: 'TRIP_CLOSED' }, { status: 409 });
    }

    await prisma.trip.update({
      where: { id },
      data: {
        lastLat: body.lat,
        lastLng: body.lng,
        lastSpeedMps: body.speed ?? undefined,
        lastHeadingDeg: body.heading ?? undefined,
        lastPositionAt: new Date(),
      },
    });
    await prisma.tripEvent.create({
      data: {
        tripId: id,
        type: 'POSITION_UPDATE',
        metadata: { lat: body.lat, lng: body.lng, speed: body.speed, heading: body.heading },
      },
    });

    const result = await recomputeTripEta(id);

    // Realtime best-effort: actualiza el canal del padre y el board del staff.
    // No rompemos el ping si Pusher/push falla.
    try {
      await broadcastTripUpdate(id);
      if (result.arrivedFiredNow) {
        await broadcastRankedTrips(trip.schoolId, trip.pickupPointId);
        await sendPushToUser(trip.parentId, {
          title: 'Llegaste al colegio',
          body: 'El colegio sabe que llegaste',
          data: { type: 'arrived-geofence', tripId: id },
        });
      } else if (result.recomputed) {
        await broadcastRankedTrips(trip.schoolId, trip.pickupPointId);
      }
    } catch {
      // no bloquear
    }

    return Response.json({
      etaSeconds: result.etaSeconds,
      status: result.trip.status,
      insideGeofence: result.insideGeofence,
      arrivedFiredNow: result.arrivedFiredNow,
      recomputed: result.recomputed,
      etaError: result.etaError ?? false,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
    }
    return jsonError(err);
  }
}
