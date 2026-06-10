import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const ALLOWED_ROLES = ['super_admin'];

export async function GET(req: Request): Promise<Response> {
  try {
    await requireRole(req, ALLOWED_ROLES);

    const subs = await prisma.subscription.findMany({
      where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            enrolledByVendors: {
              include: {
                vendor: { select: { id: true, commissionPct: true, commissionMonths: true } },
              },
            },
            _count: { select: { students: { where: { active: true } } } },
          },
        },
      },
    });

    const perSchool = subs.map((s) => {
      const quantity = s.school._count.students || 1;
      const revenue = quantity * s.pricePerStudent;
      // La comisión corre solo los primeros commissionMonths periodos desde el enroll
      const commissions = s.school.enrolledByVendors.reduce((acc, vs) => {
        if (vs.vendor.commissionMonths != null) {
          const expires = new Date(vs.enrolledAt);
          expires.setMonth(expires.getMonth() + vs.vendor.commissionMonths);
          if (expires <= new Date()) return acc;
        }
        return acc + revenue * vs.vendor.commissionPct;
      }, 0);
      return {
        schoolId: s.school.id,
        schoolName: s.school.name,
        quantity,
        revenue,
        commissions,
        status: s.status,
      };
    });

    const totalBilled = perSchool.reduce((acc, p) => acc + p.revenue, 0);
    const totalCommissions = perSchool.reduce((acc, p) => acc + p.commissions, 0);

    return Response.json({
      totalBilled: Math.round(totalBilled * 100) / 100,
      totalCommissions: Math.round(totalCommissions * 100) / 100,
      net: Math.round((totalBilled - totalCommissions) * 100) / 100,
      perSchool: perSchool
        .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100, commissions: Math.round(p.commissions * 100) / 100 }))
        .sort((a, b) => b.revenue - a.revenue),
    });
  } catch (err) {
    return jsonError(err);
  }
}
