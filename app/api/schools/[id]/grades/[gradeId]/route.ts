import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireSchool } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

const patchSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

async function assertOwnership(schoolId: string, gradeId: string): Promise<boolean> {
  const g = await prisma.grade.findUnique({
    where: { id: gradeId },
    select: { schoolId: true },
  });
  return g?.schoolId === schoolId;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; gradeId: string }> },
): Promise<Response> {
  try {
    const { id: schoolId, gradeId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    if (!(await assertOwnership(schoolId, gradeId))) {
      return Response.json({ error: 'GRADE_NOT_FOUND' }, { status: 404 });
    }
    const body = patchSchema.parse(await req.json());

    const conflict = await prisma.grade.findFirst({
      where: { schoolId, name: body.name, NOT: { id: gradeId } },
      select: { id: true },
    });
    if (conflict) {
      return Response.json({ error: 'GRADE_NAME_TAKEN' }, { status: 409 });
    }

    const grade = await prisma.grade.update({
      where: { id: gradeId },
      data: { name: body.name },
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; gradeId: string }> },
): Promise<Response> {
  try {
    const { id: schoolId, gradeId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    if (!(await assertOwnership(schoolId, gradeId))) {
      return Response.json({ error: 'GRADE_NOT_FOUND' }, { status: 404 });
    }

    const hasStudents = await prisma.student.count({
      where: { gradeId, active: true },
    });
    if (hasStudents > 0) {
      return Response.json({ error: 'GRADE_HAS_STUDENTS' }, { status: 409 });
    }

    await prisma.grade.delete({ where: { id: gradeId } });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
