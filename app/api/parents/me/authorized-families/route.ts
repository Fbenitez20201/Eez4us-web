import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const createSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(60).optional(),
  idNumber: z.string().trim().min(1).max(40).optional(),
  idPhotoUrl: z.string().url().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const families = await prisma.authorizedFamily.findMany({
      where: { parentId: session.user.id, active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        relationship: true,
        idNumber: true,
        idPhotoUrl: true,
        createdAt: true,
      },
    });
    return Response.json({ authorizedFamilies: families });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const body = createSchema.parse(await req.json());
    const family = await prisma.authorizedFamily.create({
      data: {
        parentId: session.user.id,
        fullName: body.fullName,
        relationship: body.relationship,
        idNumber: body.idNumber,
        idPhotoUrl: body.idPhotoUrl,
      },
      select: {
        id: true,
        fullName: true,
        relationship: true,
        idNumber: true,
        idPhotoUrl: true,
      },
    });
    return Response.json({ authorizedFamily: family });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
