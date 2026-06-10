import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const ALLOWED_ROLES = ['super_admin'];

const patchSchema = z.object({
  commissionPct: z.number().min(0).max(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole(req, ALLOWED_ROLES);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const vendor = await prisma.vendor.update({
      where: { id },
      data: body,
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return Response.json({ vendor });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole(req, ALLOWED_ROLES);
    const { id } = await params;
    await prisma.vendor.update({ where: { id }, data: { active: false } });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
