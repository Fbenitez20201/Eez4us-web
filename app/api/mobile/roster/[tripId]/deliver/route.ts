import { z } from 'zod';

import { prisma } from '@/lib/db';
import { sendPushToUser } from '@/lib/push';
import { broadcastRankedTrips, broadcastTripUpdate } from '@/lib/pusher-channels';
import { GATE_ROLES } from '@/lib/roster';
import { jsonError, requireRole } from '@/lib/session';

const schema = z.object({ studentId: z.string().cuid() });

// POST /api/mobile/roster/{tripId}/deliver  { studentId }  ->  { ok: true, tripFinalized }
// La miss (o staff) confirma la entrega de UN alumno (un viaje puede traer hermanos; se
// entregan por separado). Marca el TripStudent ENTREGADO + finalizedByUserId + evento
// DELIVERED_MANUAL. Cuando no queda ningún alumno pendiente, finaliza el Trip. El broadcast
// del pickup limpia TV + portón (el alumno/viaje sale de ambas vistas en realtime).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, GATE_ROLES);
    const { tripId } = await params;
    const { studentId } = schema.parse(await req.json());

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        schoolId: true,
        pickupPointId: true,
        status: true,
        parentId: true,
        tripStudents: {
          select: {
            id: true,
            studentId: true,
            deliveredAt: true,
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!trip) {
      return Response.json({ error: 'TRIP_NOT_FOUND' }, { status: 404 });
    }
    if (trip.schoolId !== session.user.schoolId) {
      return Response.json({ error: 'FORBIDDEN_SCHOOL' }, { status: 403 });
    }
    if (trip.status === 'CANCELADO') {
      return Response.json({ error: 'TRIP_CANCELED' }, { status: 409 });
    }

    const target = trip.tripStudents.find((ts) => ts.studentId === studentId);
    if (!target) {
      return Response.json({ error: 'STUDENT_NOT_IN_TRIP' }, { status: 404 });
    }
    if (target.deliveredAt) {
      return Response.json({ error: 'ALREADY_DELIVERED' }, { status: 409 });
    }

    const now = new Date();
    await prisma.tripStudent.update({
      where: { id: target.id },
      data: { deliveredAt: now, finalizedByUserId: session.user.id },
    });
    await prisma.tripEvent.create({
      data: {
        tripId,
        type: 'DELIVERED_MANUAL',
        metadata: { studentId, byUserId: session.user.id, via: 'mobile-roster' },
      },
    });

    // ¿Queda algún hermano pendiente? Si no, el viaje queda ENTREGADO.
    const pendingLeft = trip.tripStudents.some(
      (ts) => ts.studentId !== studentId && !ts.deliveredAt,
    );
    const tripFinalized = !pendingLeft;
    if (tripFinalized) {
      await prisma.trip.update({
        where: { id: tripId },
        data: {
          status: 'ENTREGADO',
          deliveredAt: now,
          endedAt: now,
          finalizedByUserId: session.user.id,
        },
      });
    }

    await Promise.allSettled([
      broadcastTripUpdate(tripId),
      broadcastRankedTrips(trip.schoolId, trip.pickupPointId),
      sendPushToUser(trip.parentId, {
        title: 'Entrega completada',
        body: `${target.student.firstName} fue entregado`,
        data: { type: 'student-delivered', tripId, studentId },
      }),
    ]);

    return Response.json({ ok: true, tripFinalized });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
    }
    return jsonError(err);
  }
}
