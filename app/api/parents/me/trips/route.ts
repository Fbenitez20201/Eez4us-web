import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const trips = await prisma.trip.findMany({
      where: { parentId: session.user.id },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        startedAt: true,
        arrivedAt: true,
        deliveredAt: true,
        endedAt: true,
        pickupPoint: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true, model: true, color: true } },
        tripStudents: {
          select: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    return Response.json({
      trips: trips.map((t) => ({
        id: t.id,
        status: t.status,
        startedAt: t.startedAt.toISOString(),
        arrivedAt: t.arrivedAt?.toISOString() ?? null,
        deliveredAt: t.deliveredAt?.toISOString() ?? null,
        endedAt: t.endedAt?.toISOString() ?? null,
        pickupPoint: t.pickupPoint,
        vehicle: t.vehicle,
        students: t.tripStudents.map((ts) => ts.student),
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
