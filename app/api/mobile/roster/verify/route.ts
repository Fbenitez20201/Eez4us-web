import { z } from 'zod';

import { prisma } from '@/lib/db';
import { broadcastRankedTrips } from '@/lib/pusher-channels';
import { createWalkupEntry, GATE_ROLES, resolveActiveEntriesForStudent } from '@/lib/roster';
import { RosterTokenError, verifyStudentQrToken } from '@/lib/roster-token';
import { jsonError, requireRole } from '@/lib/session';

// pickupPointId: el portón que opera la miss. Opcional para desempatar la recogida activa;
// OBLIGATORIO para el walk-up (define dónde se crea el viaje sintético).
const schema = z.object({
  token: z.string().min(8).max(1024),
  pickupPointId: z.string().cuid().optional(),
});

const WALKUP_ERROR_STATUS: Record<string, number> = {
  STUDENT_NOT_FOUND: 404,
  STUDENT_INACTIVE: 409,
  STUDENT_HAS_NO_PARENT: 409,
};

// POST /api/mobile/roster/verify  { token, pickupPointId? }  ->  { entry: RosterEntry }
// La miss escanea la tarjeta QR fija del alumno. La autoridad la pone ESTE endpoint, no el
// token: valida firma + escuela y resuelve la recogida activa del alumno. Si no hay viaje
// en curso, crea un walk-up (§A7-ter) en el pickupPointId del escáner.
export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, GATE_ROLES);
    if (!session.user.schoolId) {
      return Response.json({ error: 'NO_SCHOOL' }, { status: 400 });
    }
    const { token, pickupPointId } = schema.parse(await req.json());

    let claims;
    try {
      claims = await verifyStudentQrToken(token);
    } catch (err) {
      if (err instanceof RosterTokenError) {
        return Response.json({ error: err.code }, { status: 400 });
      }
      throw err;
    }

    // Ajeno: el QR pertenece a otra escuela.
    if (claims.schoolId !== session.user.schoolId) {
      return Response.json({ error: 'FOREIGN_SCHOOL' }, { status: 403 });
    }

    // ¿Ya hay una recogida activa para este alumno? (incluye un walk-up previo del mismo
    // escaneo: idempotente). groupedEntries trae a los hermanos pendientes del MISMO viaje:
    // un solo escaneo basta para que la miss libere al grupo, alumno por alumno.
    const active = await resolveActiveEntriesForStudent(
      session.user.schoolId,
      claims.studentId,
      pickupPointId,
    );
    if (active) {
      return Response.json({ entry: active.entry, groupedEntries: active.groupedEntries });
    }

    // Walk-up: sin viaje activo necesitamos saber en qué portón estamos para crearlo.
    if (!pickupPointId) {
      return Response.json({ error: 'NO_ACTIVE_PICKUP' }, { status: 404 });
    }
    const pickup = await prisma.pickupPoint.findUnique({
      where: { id: pickupPointId },
      select: { id: true, schoolId: true, active: true },
    });
    if (!pickup || pickup.schoolId !== session.user.schoolId) {
      return Response.json({ error: 'PICKUP_POINT_NOT_FOUND' }, { status: 404 });
    }
    if (!pickup.active) {
      return Response.json({ error: 'PICKUP_POINT_INACTIVE' }, { status: 409 });
    }

    const result = await createWalkupEntry({
      schoolId: session.user.schoolId,
      studentId: claims.studentId,
      pickupPointId,
      byUserId: session.user.id,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: WALKUP_ERROR_STATUS[result.error] });
    }

    // El walk-up recién creado aparece en la TV + el portón en realtime.
    try {
      await broadcastRankedTrips(session.user.schoolId, pickupPointId);
    } catch {
      // realtime best-effort
    }

    return Response.json({ entry: result.entry, groupedEntries: [result.entry] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
    }
    return jsonError(err);
  }
}
