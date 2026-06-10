import { prisma } from '@/lib/db';
import { jsonError, requireSession } from '@/lib/session';

const STAFF_ROLES = new Set(['director', 'support_staff', 'super_admin']);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireSession(req);
    const { id } = await params;

    const alert = await prisma.alert.findUnique({
      where: { id },
      select: { id: true, schoolId: true, targetUserId: true, targetRole: true, readAt: true },
    });
    if (!alert) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    if (alert.schoolId !== session.user.schoolId) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const canRead =
      alert.targetUserId === session.user.id ||
      (alert.targetUserId === null && STAFF_ROLES.has(session.user.role));
    if (!canRead) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    if (alert.readAt) {
      return Response.json({ ok: true, alreadyRead: true });
    }

    await prisma.alert.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
