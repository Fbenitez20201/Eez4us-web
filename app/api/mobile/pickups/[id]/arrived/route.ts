import { prisma } from '@/lib/db';
import { sendPushToSchoolRoles } from '@/lib/push';
import { broadcastRankedTrips, broadcastTripUpdate } from '@/lib/pusher-channels';
import { jsonError, requireRole } from '@/lib/session';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const { id } = await ctx.params;
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip || trip.parentId !== session.user.id) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    const now = new Date();
    const updated = await prisma.trip.update({
      where: { id },
      data: {
        status: 'EN_ZONA',
        arrivedAt: trip.arrivedAt ?? now,
        etaSeconds: 0,
        etaUpdatedAt: now,
      },
    });
    await prisma.tripEvent.create({
      data: { tripId: id, type: 'ARRIVED_MANUAL', metadata: { manual: true } },
    });
    try {
      await sendPushToSchoolRoles(trip.schoolId, ['director', 'support_staff'], {
        title: 'Padre llegó',
        body: `${session.user.name ?? 'Un padre'} confirmó llegada`,
        data: { type: 'trip-arrived', tripId: id },
      });
    } catch {}
    try {
      await broadcastTripUpdate(id);
      await broadcastRankedTrips(trip.schoolId, trip.pickupPointId);
    } catch {}
    return Response.json({ tripId: id, status: updated.status });
  } catch (err) {
    return jsonError(err);
  }
}
