import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireSession } from '@/lib/session';

const patchSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireSession(req);
    if (session.user.role !== 'super_admin') {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        ...body,
        resolvedAt: body.status === 'RESOLVED' || body.status === 'CLOSED' ? new Date() : null,
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
