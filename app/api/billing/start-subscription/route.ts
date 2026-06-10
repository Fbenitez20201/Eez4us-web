import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';
import { createCustomer, createSubscription } from '@/lib/stripe';

const ALLOWED_ROLES = ['director', 'super_admin'];

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ALLOWED_ROLES);
    const schoolId = session.user.schoolId;
    if (!schoolId) {
      return Response.json({ error: 'NO_SCHOOL' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        stripeCustomerId: true,
        users: {
          where: { role: 'director' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { email: true },
        },
      },
    });
    if (!school) {
      return Response.json({ error: 'SCHOOL_NOT_FOUND' }, { status: 404 });
    }

    const existing = await prisma.subscription.findUnique({
      where: { schoolId },
      select: { id: true, stripeSubscriptionId: true, status: true },
    });
    if (existing?.stripeSubscriptionId && existing.status !== 'CANCELED') {
      return Response.json(
        { error: 'SUBSCRIPTION_ALREADY_EXISTS', subscriptionId: existing.stripeSubscriptionId },
        { status: 409 },
      );
    }

    if (!school.stripeCustomerId) {
      await createCustomer({
        id: school.id,
        name: school.name,
        directorEmail: school.users[0]?.email ?? null,
      });
    }

    const studentCount = await prisma.student.count({
      where: { schoolId, active: true },
    });

    const sub = await createSubscription(schoolId, Math.max(studentCount, 1));

    await prisma.subscription.upsert({
      where: { schoolId },
      create: {
        schoolId,
        stripeSubscriptionId: sub.id,
        status: 'TRIALING',
        pricePerStudent: 10,
      },
      update: {
        stripeSubscriptionId: sub.id,
        status: 'TRIALING',
      },
    });

    return Response.json({ subscriptionId: sub.id, quantity: studentCount });
  } catch (err) {
    return jsonError(err);
  }
}
