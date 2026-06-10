import { z } from 'zod';

import { onStudentCreated } from '@/lib/billing-hooks';
import { prisma } from '@/lib/db';
import { inviteRepresentatives, representativeSchema } from '@/lib/invitations';
import { jsonError, requireSchool } from '@/lib/session';
import { normalizePickup, pickupFields } from '@/lib/student-pickup';

const ALLOWED_ROLES = ['director', 'super_admin'];

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  gradeId: z.string().min(1).nullable().optional(),
  externalId: z.string().trim().min(1).max(40).nullable().optional(),
  birthDate: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  ...pickupFields,
  representatives: z.array(representativeSchema).max(10).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: schoolId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    const body = createSchema.parse(await req.json());

    if (body.gradeId) {
      const g = await prisma.grade.findUnique({
        where: { id: body.gradeId },
        select: { schoolId: true },
      });
      if (!g || g.schoolId !== schoolId) {
        return Response.json({ error: 'GRADE_NOT_FOUND' }, { status: 404 });
      }
    }

    if (body.externalId) {
      const conflict = await prisma.student.findUnique({
        where: { schoolId_externalId: { schoolId, externalId: body.externalId } },
        select: { id: true },
      });
      if (conflict) {
        return Response.json({ error: 'EXTERNAL_ID_TAKEN' }, { status: 409 });
      }
    }

    const pickup = normalizePickup(body);
    if (!pickup.ok) {
      return Response.json({ error: pickup.error }, { status: 400 });
    }

    const student = await prisma.student.create({
      data: {
        schoolId,
        firstName: body.firstName,
        lastName: body.lastName,
        gradeId: body.gradeId ?? null,
        externalId: body.externalId ?? null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        ...pickup.value,
      },
      select: { id: true, firstName: true, lastName: true, externalId: true, gradeId: true },
    });
    await onStudentCreated(schoolId);

    const reps = body.representatives ?? [];
    const studentName = `${student.firstName} ${student.lastName}`.trim();
    const { createdCount, sentCount, repErrors } =
      reps.length > 0
        ? await inviteRepresentatives({
            schoolId,
            studentIds: [student.id],
            studentNames: [studentName],
            representatives: reps,
          })
        : { createdCount: 0, sentCount: 0, repErrors: [] };

    return Response.json({
      student,
      invitations: { createdCount, sentCount },
      repErrors,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
