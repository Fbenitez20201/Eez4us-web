import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireSchool } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: schoolId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    const body = createSchema.parse(await req.json());

    const exists = await prisma.grade.findUnique({
      where: { schoolId_name: { schoolId, name: body.name } },
      select: { id: true },
    });
    if (exists) {
      return Response.json({ error: 'GRADE_NAME_TAKEN' }, { status: 409 });
    }

    const grade = await prisma.grade.create({
      data: { schoolId, name: body.name },
      select: { id: true, name: true },
    });
    return Response.json({ grade });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
