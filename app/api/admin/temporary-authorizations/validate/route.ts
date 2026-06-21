import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const schema = z.object({ code: z.string().trim().min(3).max(20) });

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['director', 'support_staff', 'super_admin']);
    if (!session.user.schoolId) {
      return Response.json({ error: 'NO_SCHOOL' }, { status: 400 });
    }
    const body = schema.parse(await req.json());
    const auth = await prisma.temporaryAuthorization.findUnique({
      where: { code: body.code.toUpperCase() },
      include: {
        parent: { select: { id: true, name: true, email: true, phoneE164: true } },
      },
    });
    if (!auth || auth.schoolId !== session.user.schoolId) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (auth.revokedAt) {
      return Response.json({ error: 'REVOKED' }, { status: 410 });
    }
    if (auth.usedAt) {
      return Response.json({ error: 'ALREADY_USED', usedAt: auth.usedAt.toISOString() }, { status: 409 });
    }
    const validToday = new Date(auth.validDate);
    const now = new Date();
    if (validToday.toDateString() !== now.toDateString()) {
      return Response.json({
        error: 'NOT_VALID_TODAY',
        validDate: validToday.toISOString(),
      }, { status: 409 });
    }

    const students = await prisma.student.findMany({
      where: { id: { in: auth.studentIds } },
      select: { id: true, firstName: true, lastName: true, grade: { select: { name: true } } },
    });

    return Response.json({
      authorization: {
        id: auth.id,
        personName: auth.personName,
        documentType: auth.documentType,
        documentId: auth.documentId,
        vehicleInfo: auth.vehicleInfo,
        validDate: auth.validDate.toISOString(),
        parent: auth.parent,
        students,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
    }
    return jsonError(err);
  }
}
