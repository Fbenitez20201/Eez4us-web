import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

export const runtime = 'edge';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const { id } = await params;
    const result = await prisma.authorizedFamily.updateMany({
      where: { id, parentId: session.user.id },
      data: { active: false },
    });
    if (result.count === 0) {
      return Response.json({ error: 'AUTHORIZED_FAMILY_NOT_FOUND' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
