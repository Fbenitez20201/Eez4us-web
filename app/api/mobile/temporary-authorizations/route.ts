import { z } from 'zod';

import { prisma } from '@/lib/db';
import { DOCUMENT_TYPES } from '@/lib/documents';
import { jsonError, requireRole } from '@/lib/session';

const schema = z.object({
  personName: z.string().trim().min(1).max(120),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  documentId: z.string().trim().max(40).optional(),
  vehicleInfo: z.string().trim().max(120).optional(),
  validDate: z.string().datetime(),
  studentIds: z.array(z.string().cuid()).min(1),
});

function shortCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const items = await prisma.temporaryAuthorization.findMany({
      where: { parentId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return Response.json({ authorizations: items });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    if (!session.user.schoolId) {
      return Response.json({ error: 'NO_SCHOOL' }, { status: 400 });
    }
    const body = schema.parse(await req.json());

    // validate students are this parent's
    const links = await prisma.parentStudent.findMany({
      where: { parentId: session.user.id, studentId: { in: body.studentIds } },
    });
    if (links.length !== body.studentIds.length) {
      return Response.json({ error: 'INVALID_STUDENTS' }, { status: 400 });
    }

    let code = shortCode();
    for (let i = 0; i < 3; i++) {
      const exists = await prisma.temporaryAuthorization.findUnique({ where: { code } });
      if (!exists) break;
      code = shortCode();
    }

    const created = await prisma.temporaryAuthorization.create({
      data: {
        schoolId: session.user.schoolId,
        parentId: session.user.id,
        personName: body.personName,
        documentType: body.documentType,
        documentId: body.documentId,
        vehicleInfo: body.vehicleInfo,
        validDate: new Date(body.validDate),
        studentIds: body.studentIds,
        code,
      },
    });
    return Response.json({ authorization: created, code, qrCode: `eez4us://temp/${code}` }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
