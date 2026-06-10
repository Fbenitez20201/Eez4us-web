import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireSession } from '@/lib/session';

const createSchema = z.object({
  type: z.enum(['BUG', 'IMPROVEMENT', 'SUPPORT']),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(3).max(4000),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireSession(req);
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') ?? 'mine';
    const status = url.searchParams.get('status');

    const isAdmin = session.user.role === 'super_admin';
    const where: Record<string, unknown> = {};
    if (scope === 'all') {
      if (!isAdmin) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    } else {
      where.reportedById = session.user.id;
    }
    if (status) where.status = status;

    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        reportedBy: { select: { id: true, name: true, email: true } },
        school: { select: { id: true, name: true } },
      },
    });

    return Response.json({ tickets });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireSession(req);
    const body = createSchema.parse(await req.json());

    const ticket = await prisma.supportTicket.create({
      data: {
        reportedById: session.user.id,
        schoolId: session.user.schoolId ?? null,
        type: body.type,
        title: body.title,
        description: body.description,
      },
    });
    return Response.json({ ticket });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
