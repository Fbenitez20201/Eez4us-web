import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { jsonError, requireSession } from '@/lib/session';

const STAFF_ROLES = new Set(['director', 'support_staff', 'super_admin']);

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireSession(req);

    if (!session.user.schoolId) {
      return Response.json({ alerts: [], unreadCount: 0 });
    }

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);

    const where: Prisma.AlertWhereInput = {
      schoolId: session.user.schoolId,
    };

    if (STAFF_ROLES.has(session.user.role)) {
      where.OR = [
        { targetUserId: session.user.id },
        { targetUserId: null, targetRole: session.user.role },
        { targetUserId: null, targetRole: null },
      ];
    } else {
      where.targetUserId = session.user.id;
    }

    if (unreadOnly) {
      where.readAt = null;
    }

    const [alerts, unreadCount] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          severity: true,
          payload: true,
          readAt: true,
          createdAt: true,
          targetUserId: true,
          targetRole: true,
        },
      }),
      prisma.alert.count({ where: { ...where, readAt: null } }),
    ]);

    return Response.json({ alerts, unreadCount });
  } catch (err) {
    return jsonError(err);
  }
}
