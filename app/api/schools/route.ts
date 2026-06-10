import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  internalCode: z
    .string()
    .trim()
    .min(4)
    .max(12)
    .regex(/^[A-Z0-9]+$/, 'internalCode debe ser A-Z 0-9'),
  addressText: z.string().trim().max(200).optional(),
  addressLat: z.number().min(-90).max(90).optional(),
  addressLng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole(req, ['super_admin']);
    const body = bodySchema.parse(await req.json());

    const exists = await prisma.school.findUnique({
      where: { internalCode: body.internalCode },
      select: { id: true },
    });
    if (exists) {
      return Response.json({ error: 'INTERNAL_CODE_TAKEN' }, { status: 409 });
    }

    const school = await prisma.school.create({
      data: {
        name: body.name,
        internalCode: body.internalCode,
        addressText: body.addressText,
        addressLat: body.addressLat,
        addressLng: body.addressLng,
      },
      select: { id: true, name: true, internalCode: true },
    });

    return Response.json({ school });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
