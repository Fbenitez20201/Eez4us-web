import { z } from 'zod';

import { onStudentActivationChanged, onStudentDeactivated } from '@/lib/billing-hooks';
import { prisma } from '@/lib/db';
import { jsonError, requireSchool } from '@/lib/session';
import type { NormalizedPickup } from '@/lib/student-pickup';
import { normalizePickup, pickupFields } from '@/lib/student-pickup';

const ALLOWED_ROLES = ['director', 'super_admin'];

const patchSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  gradeId: z.string().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).max(40).nullable().optional(),
  birthDate: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  active: z.boolean().optional(),
  ...pickupFields,
});

async function loadStudent(schoolId: string, studentId: string) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true, externalId: true, active: true },
  });
  return s?.schoolId === schoolId ? s : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> },
): Promise<Response> {
  try {
    const { id: schoolId, studentId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    const current = await loadStudent(schoolId, studentId);
    if (!current) {
      return Response.json({ error: 'STUDENT_NOT_FOUND' }, { status: 404 });
    }
    const body = patchSchema.parse(await req.json());

    if (body.gradeId) {
      const g = await prisma.grade.findUnique({
        where: { id: body.gradeId },
        select: { schoolId: true },
      });
      if (!g || g.schoolId !== schoolId) {
        return Response.json({ error: 'GRADE_NOT_FOUND' }, { status: 404 });
      }
    }

    if (body.externalId && body.externalId !== current.externalId) {
      const conflict = await prisma.student.findUnique({
        where: { schoolId_externalId: { schoolId, externalId: body.externalId } },
        select: { id: true },
      });
      if (conflict) {
        return Response.json({ error: 'EXTERNAL_ID_TAKEN' }, { status: 409 });
      }
    }

    let pickup: NormalizedPickup | undefined;
    if (body.pickupMode !== undefined) {
      const r = normalizePickup(body, body.pickupMode);
      if (!r.ok) {
        return Response.json({ error: r.error }, { status: 400 });
      }
      pickup = r.value;
    }

    const student = await prisma.student.update({
      where: { id: studentId },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        gradeId: body.gradeId,
        externalId: body.externalId,
        birthDate: body.birthDate ? new Date(body.birthDate) : body.birthDate,
        active: body.active,
        ...(pickup ?? {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        externalId: true,
        gradeId: true,
        active: true,
      },
    });
    if (body.active !== undefined) {
      await onStudentActivationChanged(schoolId, current.active, body.active);
    }
    return Response.json({ student });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; studentId: string }> },
): Promise<Response> {
  try {
    const { id: schoolId, studentId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    const current = await loadStudent(schoolId, studentId);
    if (!current) {
      return Response.json({ error: 'STUDENT_NOT_FOUND' }, { status: 404 });
    }
    await prisma.student.update({
      where: { id: studentId },
      data: { active: false },
    });
    if (current.active) {
      await onStudentDeactivated(schoolId);
    }
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
