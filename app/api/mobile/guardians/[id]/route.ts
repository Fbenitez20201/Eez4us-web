import { z } from 'zod';

import { prisma } from '@/lib/db';
import { DOCUMENT_TYPES } from '@/lib/documents';
import { jsonError, requireRole } from '@/lib/session';

const updateSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  relationship: z.string().trim().max(40).nullable().optional(),
  documentType: z.enum(DOCUMENT_TYPES).nullable().optional(),
  idNumber: z.string().trim().max(40).nullable().optional(),
  idPhotoUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
});

async function ensureOwner(parentId: string, id: string) {
  const g = await prisma.authorizedFamily.findUnique({ where: { id } });
  if (!g || g.parentId !== parentId) return null;
  return g;
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const { id } = await ctx.params;
    const existing = await ensureOwner(session.user.id, id);
    if (!existing) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    const body = updateSchema.parse(await req.json());
    const updated = await prisma.authorizedFamily.update({ where: { id }, data: body });
    return Response.json({ guardian: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const { id } = await ctx.params;
    const existing = await ensureOwner(session.user.id, id);
    if (!existing) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    await prisma.authorizedFamily.update({ where: { id }, data: { active: false } });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
