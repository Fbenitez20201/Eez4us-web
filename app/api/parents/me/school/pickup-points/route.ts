import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    if (!session.user.schoolId) {
      return Response.json({ error: 'PARENT_HAS_NO_SCHOOL' }, { status: 400 });
    }
    const pickupPoints = await prisma.pickupPoint.findMany({
      where: { schoolId: session.user.schoolId, active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        centerLat: true,
        centerLng: true,
        radiusMeters: true,
      },
    });
    return Response.json({ pickupPoints });
  } catch (err) {
    return jsonError(err);
  }
}
