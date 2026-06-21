import { z } from 'zod';

import { prisma } from '@/lib/db';
import { DOCUMENT_TYPES } from '@/lib/documents';
import { jsonError, requireRole } from '@/lib/session';

const createSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  relationship: z.string().trim().max(40).optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  idNumber: z.string().trim().max(40).optional(),
  idPhotoUrl: z.string().url().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const guardians = await prisma.authorizedFamily.findMany({
      where: { parentId: session.user.id, active: true },
      orderBy: { createdAt: 'asc' },
    });
    return Response.json({ guardians });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const body = createSchema.parse(await req.json());
    const guardian = await prisma.authorizedFamily.create({
      data: { parentId: session.user.id, ...body },
    });
    return Response.json({ guardian }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
    }
    return jsonError(err);
  }
}
