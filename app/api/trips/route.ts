import { z } from 'zod';

import { prisma } from '@/lib/db';
import { broadcastRankedTrips, broadcastTripUpdate } from '@/lib/pusher-channels';
import { jsonError, requireRole } from '@/lib/session';

export const runtime = 'edge';

const bodySchema = z.object({
  pickupPointId: z.string().min(1),
  vehicleId: z.string().min(1),
  authorizedFamilyId: z.string().min(1).optional(),
  studentIds: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const body = bodySchema.parse(await req.json());

    const pickupPoint = await prisma.pickupPoint.findUnique({
      where: { id: body.pickupPointId },
      select: { id: true, schoolId: true, active: true },
    });
    if (!pickupPoint || !pickupPoint.active) {
      return Response.json({ error: 'PICKUP_POINT_NOT_FOUND' }, { status: 404 });
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, parentId: session.user.id, active: true },
      select: { id: true },
    });
    if (!vehicle) {
      return Response.json({ error: 'VEHICLE_NOT_OWNED' }, { status: 403 });
    }

    if (body.authorizedFamilyId) {
      const fam = await prisma.authorizedFamily.findFirst({
        where: { id: body.authorizedFamilyId, parentId: session.user.id, active: true },
        select: { id: true },
      });
      if (!fam) {
        return Response.json({ error: 'AUTHORIZED_FAMILY_NOT_OWNED' }, { status: 403 });
      }
    }

    const ownedStudents = await prisma.parentStudent.findMany({
      where: { parentId: session.user.id, studentId: { in: body.studentIds } },
      select: { studentId: true, student: { select: { schoolId: true } } },
    });
    if (ownedStudents.length !== body.studentIds.length) {
      return Response.json({ error: 'STUDENT_NOT_OWNED' }, { status: 403 });
    }
    if (ownedStudents.some((s) => s.student.schoolId !== pickupPoint.schoolId)) {
      return Response.json({ error: 'STUDENT_SCHOOL_MISMATCH' }, { status: 400 });
    }

    const trip = await prisma.trip.create({
      data: {
        schoolId: pickupPoint.schoolId,
        pickupPointId: pickupPoint.id,
        parentId: session.user.id,
        vehicleId: body.vehicleId,
        authorizedFamilyId: body.authorizedFamilyId,
        tripStudents: { create: body.studentIds.map((studentId) => ({ studentId })) },
        events: { create: { type: 'STARTED' } },
      },
      select: { id: true, schoolId: true, pickupPointId: true },
    });

    await Promise.allSettled([
      broadcastTripUpdate(trip.id),
      broadcastRankedTrips(trip.schoolId, trip.pickupPointId),
    ]);

    return Response.json({ tripId: trip.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
