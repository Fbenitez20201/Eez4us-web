import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ALLOWED_ROLES);
    const url = new URL(req.url);
    const schoolId = url.searchParams.get('schoolId') ?? session.user.schoolId;
    if (!schoolId) {
      return Response.json({ error: 'NO_SCHOOL' }, { status: 400 });
    }
    if (session.user.role !== 'super_admin' && session.user.schoolId !== schoolId) {
      return Response.json({ error: 'FORBIDDEN_SCHOOL' }, { status: 403 });
    }

    const daysParam = Number(url.searchParams.get('days') ?? '30');
    const days = Math.min(Math.max(daysParam, 7), 90);
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));

    const trips = await prisma.trip.findMany({
      where: { schoolId, status: 'ENTREGADO', deliveredAt: { gte: cutoff } },
      select: {
        deliveredAt: true,
        tripStudents: {
          select: { studentId: true, student: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    const dayBuckets: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      dayBuckets.push(dayKey(d));
    }

    const seriesByStudent = new Map<string, { name: string; data: Map<string, number> }>();
    for (const t of trips) {
      if (!t.deliveredAt) continue;
      const k = dayKey(t.deliveredAt);
      for (const ts of t.tripStudents) {
        const name = `${ts.student.firstName} ${ts.student.lastName}`;
        const cur = seriesByStudent.get(ts.studentId) ?? { name, data: new Map() };
        cur.data.set(k, (cur.data.get(k) ?? 0) + 1);
        seriesByStudent.set(ts.studentId, cur);
      }
    }

    const series = Array.from(seriesByStudent.entries()).map(([studentId, v]) => ({
      studentId,
      name: v.name,
      points: dayBuckets.map((day) => ({ day, count: v.data.get(day) ?? 0 })),
    }));

    const totalPerDay = dayBuckets.map((day) => ({
      day,
      count: Array.from(seriesByStudent.values()).reduce(
        (acc, s) => acc + (s.data.get(day) ?? 0),
        0,
      ),
    }));

    return Response.json({ days: dayBuckets, totalPerDay, series });
  } catch (err) {
    return jsonError(err);
  }
}
