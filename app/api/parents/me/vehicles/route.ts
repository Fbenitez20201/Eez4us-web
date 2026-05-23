import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

export const runtime = 'edge';

const createSchema = z.object({
  plate: z.string().trim().min(1).max(20),
  model: z.string().trim().min(1).max(60),
  color: z.string().trim().min(1).max(30),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const vehicles = await prisma.vehicle.findMany({
      where: { parentId: session.user.id, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, plate: true, model: true, color: true, createdAt: true },
    });
    return Response.json({ vehicles });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const body = createSchema.parse(await req.json());
    const vehicle = await prisma.vehicle.create({
      data: {
        parentId: session.user.id,
        plate: body.plate,
        model: body.model,
        color: body.color,
      },
      select: { id: true, plate: true, model: true, color: true },
    });
    return Response.json({ vehicle });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
