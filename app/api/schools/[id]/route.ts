import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireSchool } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  internalCode: z
    .string()
    .trim()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9]+$/, 'internalCode debe ser A-Z 0-9')
    .optional(),
  addressText: z.string().trim().max(200).nullable().optional(),
  addressLat: z.number().min(-90).max(90).nullable().optional(),
  addressLng: z.number().min(-180).max(180).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await params;
    await requireSchool(req, id, ALLOWED_ROLES);
    const body = patchSchema.parse(await req.json());

    if (body.internalCode) {
      const conflict = await prisma.school.findFirst({
        where: { internalCode: body.internalCode, NOT: { id } },
        select: { id: true },
      });
      if (conflict) {
        return Response.json({ error: 'INTERNAL_CODE_TAKEN' }, { status: 409 });
      }
    }

    const school = await prisma.school.update({
      where: { id },
      data: body,
      select: {
        id: true,
        name: true,
        internalCode: true,
        addressText: true,
        addressLat: true,
        addressLng: true,
      },
    });

    return Response.json({ school });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
