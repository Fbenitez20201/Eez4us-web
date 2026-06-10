import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  internalCode: z.string().trim().min(3).max(64),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  director: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }),
});

export async function GET(req: Request): Promise<Response> {
  try {
    await requireRole(req, ['super_admin']);
    const schools = await prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subscription: true, _count: { select: { students: true, users: true } } },
    });
    return Response.json({ schools });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['super_admin']);
    const body = schema.parse(await req.json());

    const codeUpper = body.internalCode.toUpperCase();
    const exists = await prisma.school.findUnique({ where: { internalCode: codeUpper } });
    if (exists) {
      return Response.json({ error: 'CODE_ALREADY_USED' }, { status: 409 });
    }
    const emailExists = await prisma.user.findUnique({ where: { email: body.director.email } });
    if (emailExists) {
      return Response.json({ error: 'DIRECTOR_EMAIL_ALREADY_USED' }, { status: 409 });
    }

    const school = await prisma.school.create({
      data: {
        name: body.name,
        internalCode: codeUpper,
        city: body.city || null,
        country: body.country || null,
      },
    });

    await auth.api.signUpEmail({
      body: {
        email: body.director.email,
        password: body.director.password,
        name: body.director.name,
      },
    });
    await prisma.user.update({
      where: { email: body.director.email },
      data: { role: 'director', schoolId: school.id, emailVerified: true },
    });

    await prisma.subscription.create({
      data: {
        schoolId: school.id,
        status: 'TRIALING',
        pricePerStudent: 10,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        schoolId: school.id,
        action: 'CREATE',
        entity: 'School',
        entityId: school.id,
        metadata: { directorEmail: body.director.email },
      },
    });

    return Response.json({ school }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
