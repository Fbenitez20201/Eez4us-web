import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const trip = await prisma.trip.findFirst({
      where: {
        parentId: session.user.id,
        status: { in: ['EN_CAMINO', 'EN_ZONA'] },
        isWalkup: false,
      },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        arrivedAt: true,
        etaSeconds: true,
        etaUpdatedAt: true,
        lastLat: true,
        lastLng: true,
        lastHeadingDeg: true,
        lastSpeedMps: true,
        lastPositionAt: true,
        pickupPoint: {
          select: { id: true, name: true, centerLat: true, centerLng: true, radiusMeters: true },
        },
        vehicle: { select: { id: true, plate: true, model: true, color: true } },
        authorizedFamily: { select: { id: true, fullName: true, relationship: true } },
        tripStudents: {
          select: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!trip) {
      return Response.json({ trip: null });
    }
    return Response.json({
      trip: {
        id: trip.id,
        status: trip.status,
        startedAt: trip.startedAt.toISOString(),
        arrivedAt: trip.arrivedAt?.toISOString() ?? null,
        etaSeconds: trip.etaSeconds,
        etaUpdatedAt: trip.etaUpdatedAt?.toISOString() ?? null,
        lastLat: trip.lastLat,
        lastLng: trip.lastLng,
        lastHeadingDeg: trip.lastHeadingDeg,
        lastSpeedMps: trip.lastSpeedMps,
        lastPositionAt: trip.lastPositionAt?.toISOString() ?? null,
        pickupPoint: trip.pickupPoint,
        vehicle: trip.vehicle,
        authorizedFamily: trip.authorizedFamily,
        students: trip.tripStudents.map((ts) => ts.student),
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
