import { prisma } from '@/lib/db';
import { dayKeyInTz, lastLocalDays } from '@/lib/format';
import { jsonError, requireRole } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

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

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { timezone: true },
    });
    const tz = school?.timezone ?? null;

    const daysParam = Number(url.searchParams.get('days') ?? '30');
    const days = Math.min(Math.max(daysParam, 7), 90);
    // Cutoff con margen de 1 día por el corrimiento UTC↔local; el bucketing local descarta sobrantes.
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);

    const trips = await prisma.trip.findMany({
      where: { schoolId, status: 'ENTREGADO', deliveredAt: { gte: cutoff } },
      select: {
        deliveredAt: true,
        tripStudents: {
          select: { studentId: true, student: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Días bucketeados en la hora local del colegio (no UTC).
    const dayBuckets = lastLocalDays(days, tz);

    const seriesByStudent = new Map<string, { name: string; data: Map<string, number> }>();
    for (const t of trips) {
      if (!t.deliveredAt) continue;
      const k = dayKeyInTz(t.deliveredAt, tz);
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
