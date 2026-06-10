import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const upsertSchema = z.object({
  expoPushToken: z.string().trim().min(10).max(200),
  platform: z.enum(['ios', 'android']),
});

const deleteSchema = z.object({
  expoPushToken: z.string().trim().min(10).max(200).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const body = upsertSchema.parse(await req.json());

    const token = await prisma.pushToken.upsert({
      where: { expoPushToken: body.expoPushToken },
      create: {
        userId: session.user.id,
        expoPushToken: body.expoPushToken,
        platform: body.platform,
      },
      update: {
        userId: session.user.id,
        platform: body.platform,
        lastSeenAt: new Date(),
      },
      select: { id: true, expoPushToken: true, platform: true, lastSeenAt: true },
    });

    return Response.json({ token });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    let body: { expoPushToken?: string } = {};
    try {
      body = deleteSchema.parse(await req.json());
    } catch {
      body = {};
    }

    if (body.expoPushToken) {
      await prisma.pushToken.deleteMany({
        where: { userId: session.user.id, expoPushToken: body.expoPushToken },
      });
    } else {
      await prisma.pushToken.deleteMany({ where: { userId: session.user.id } });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
