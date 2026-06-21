import { z } from 'zod';

import { prisma } from '@/lib/db';
import { validatePhoneForCountry } from '@/lib/phone';
import { jsonError, requireSession } from '@/lib/session';

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/)
    .nullable()
    .optional(),
  image: z.string().url().nullable().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireSession(req);
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        phoneE164: true,
        emailVerified: true,
      },
    });
    return Response.json({ profile: user });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PUT(req: Request): Promise<Response> {
  try {
    const session = await requireSession(req);
    const body = updateSchema.parse(await req.json());

    // El teléfono debe respetar el país de la escuela del padre (prefijo + longitud).
    if (body.phoneE164) {
      const school = session.user.schoolId
        ? await prisma.school.findUnique({
            where: { id: session.user.schoolId },
            select: { country: true },
          })
        : null;
      if (!validatePhoneForCountry(body.phoneE164, school?.country).valid) {
        return Response.json({ error: 'PHONE_INVALID' }, { status: 400 });
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: body,
      select: { id: true, name: true, phoneE164: true, image: true },
    });
    return Response.json({ profile: user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
