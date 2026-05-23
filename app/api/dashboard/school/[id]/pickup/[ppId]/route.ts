import { prisma } from '@/lib/db';
import { buildRankedTrips } from '@/lib/pusher-channels';
import { jsonError, requireSchool } from '@/lib/session';

export const runtime = 'edge';

const ALLOWED_ROLES = ['director', 'support_staff', 'super_admin'];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; ppId: string }> },
): Promise<Response> {
  try {
    const { id: schoolId, ppId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);

    const pickup = await prisma.pickupPoint.findUnique({
      where: { id: ppId },
      select: { id: true, schoolId: true, name: true, centerLat: true, centerLng: true, radiusMeters: true },
    });
    if (!pickup || pickup.schoolId !== schoolId) {
      return Response.json({ error: 'PICKUP_POINT_NOT_FOUND' }, { status: 404 });
    }

    const trips = await buildRankedTrips(schoolId, ppId);
    return Response.json({
      pickupPoint: {
        id: pickup.id,
        name: pickup.name,
        centerLat: pickup.centerLat,
        centerLng: pickup.centerLng,
        radiusMeters: pickup.radiusMeters,
      },
      trips,
    });
  } catch (err) {
    return jsonError(err);
  }
}
