import { prisma } from '@/lib/db';
import { GATE_ROLES } from '@/lib/roster';
import { mintStudentQrToken } from '@/lib/roster-token';
import { jsonError, requireSession } from '@/lib/session';

// GET /api/mobile/students/{id}/qr  ->  { token, expiresAt }
// Tarjeta QR FIJA por alumno (A7-bis). Token estable firmado (HMAC studentId+schoolId),
// no de corta vida: el padre la imprime/comparte para que la presente un familiar sin app
// (la abuela). La autoridad la valida el `verify`, no el token (es inofensivo si se filtra).
//
// Dos lectores legítimos (BRECHA 1):
//  - parent: solo SUS alumnos (ParentStudent).
//  - portón (GATE_ROLES = logistics/support_staff/director/super_admin): cualquier alumno de
//    SU MISMA escuela, p.ej. para reimprimir una tarjeta perdida. Multi-tenant estricto:
//    schoolId del alumno === schoolId del staff (super_admin puede cualquier escuela).
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireSession(req);
    const { id: studentId } = await ctx.params;
    const { role, id: userId, schoolId } = session.user;

    if (role === 'parent') {
      // El padre solo puede mintear la tarjeta de SUS alumnos (ParentStudent).
      const link = await prisma.parentStudent.findFirst({
        where: { parentId: userId, studentId },
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
    }

    if (GATE_ROLES.includes(role)) {
      // staff sin escuela (mal provisionado) no puede leer ninguna tarjeta: error claro, no FOREIGN.
      if (role !== 'super_admin' && !schoolId) {
        return Response.json({ error: 'NO_SCHOOL' }, { status: 400 });
      }
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, schoolId: true, active: true },
      });
      if (!student) {
        return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
      }
      // super_admin opera global; el resto del staff, solo su escuela.
      if (role !== 'super_admin' && student.schoolId !== schoolId) {
        return Response.json({ error: 'FOREIGN_SCHOOL' }, { status: 403 });
      }
      if (!student.active) {
        return Response.json({ error: 'STUDENT_INACTIVE' }, { status: 409 });
      }
      const { token, expiresAt } = await mintStudentQrToken({
        studentId: student.id,
        schoolId: student.schoolId,
      });
      return Response.json({ token, expiresAt });
    }

    return Response.json({ error: 'Forbidden' }, { status: 403 });
  } catch (err) {
    return jsonError(err);
  }
}
