import { prisma } from '@/lib/db';
import { mintStudentQrToken } from '@/lib/roster-token';
import { jsonError, requireRole } from '@/lib/session';

// GET /api/mobile/students/{id}/qr  ->  { token, expiresAt }
// Tarjeta QR FIJA por alumno (A7-bis). Token estable firmado (HMAC studentId+schoolId),
// no de corta vida: el padre la imprime/comparte para que la presente un familiar sin app
// (la abuela). Reemplaza al viejo pickups/{id}/qr (token dinámico por viaje, retirado).
// La autoridad la valida el `verify`, no el token.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const { id: studentId } = await ctx.params;

    // El padre solo puede mintear la tarjeta de SUS alumnos (ParentStudent).
    const link = await prisma.parentStudent.findFirst({
      where: { parentId: session.user.id, studentId },
      select: { student: { select: { id: true, schoolId: true, active: true } } },
    });
    if (!link) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (!link.student.active) {
      return Response.json({ error: 'STUDENT_INACTIVE' }, { status: 409 });
    }

    const { token, expiresAt } = await mintStudentQrToken({
      studentId: link.student.id,
      schoolId: link.student.schoolId,
    });
    return Response.json({ token, expiresAt });
  } catch (err) {
    return jsonError(err);
  }
}
