import { prisma } from '@/lib/db';
import { GATE_ROLES, getPickupRoster } from '@/lib/roster';
import { jsonError, requireRole } from '@/lib/session';

// GET /api/mobile/roster?pickupPointId=...  ->  { entries: RosterEntry[] }
// Lista del portón para la "miss" (logistics) + staff. Multi-tenant: el pickup
// point debe pertenecer a la escuela de la sesión.
export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, GATE_ROLES);
    if (!session.user.schoolId) {
      return Response.json({ error: 'NO_SCHOOL' }, { status: 400 });
    }

    const pickupPointId = new URL(req.url).searchParams.get('pickupPointId');
    if (!pickupPointId) {
      return Response.json({ error: 'PICKUP_POINT_REQUIRED' }, { status: 400 });
    }

    const pickup = await prisma.pickupPoint.findUnique({
      where: { id: pickupPointId },
      select: { id: true, schoolId: true },
    });
    if (!pickup || pickup.schoolId !== session.user.schoolId) {
      return Response.json({ error: 'PICKUP_POINT_NOT_FOUND' }, { status: 404 });
    }

    const entries = await getPickupRoster(session.user.schoolId, pickup.id);
    return Response.json({ entries });
  } catch (err) {
    return jsonError(err);
  }
}
