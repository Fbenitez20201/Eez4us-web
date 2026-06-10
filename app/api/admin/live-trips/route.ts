import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['director', 'support_staff', 'super_admin']);
    if (!session.user.schoolId) return Response.json({ trips: [] });
    const trips = await prisma.trip.findMany({
      where: {
        schoolId: session.user.schoolId,
        status: { in: ['EN_CAMINO', 'EN_ZONA'] },
      },
      orderBy: [{ etaSeconds: 'asc' }, { startedAt: 'asc' }],
      include: {
        parent: { select: { id: true, name: true, email: true } },
        vehicle: { select: { plate: true, model: true, color: true } },
        pickupPoint: { select: { id: true, name: true } },
        tripStudents: {
          where: { deliveredAt: null },
          include: { student: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    return Response.json({
      trips: trips.map((t) => ({
        id: t.id,
        parentName: t.parent.name ?? t.parent.email,
        studentNames: t.tripStudents.map((ts) => `${ts.student.firstName} ${ts.student.lastName}`),
        pickupPointId: t.pickupPoint.id,
        pickupPointName: t.pickupPoint.name,
        isWalkup: t.isWalkup,
        origin: t.origin,
        vehiclePlate: t.vehicle?.plate ?? null,
        vehicleModel: t.vehicle?.model ?? null,
        vehicleColor: t.vehicle?.color ?? null,
        status: t.status,
        etaSeconds: t.etaSeconds,
        lastLat: t.lastLat,
        lastLng: t.lastLng,
        lastPositionAt: t.lastPositionAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
