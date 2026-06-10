import { redirect } from 'next/navigation';

import { LiveArrivalsBoard } from '@/components/admin/live-arrivals-board';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

interface DismissalBucket {
  time: string;
  levels: string[];
  gradeNames: string[];
  studentsCount: number;
}

export default async function DashboardHomePage() {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  const schoolId = session.user.schoolId;

  const [pickupPoints, grades] = await Promise.all([
    prisma.pickupPoint.findMany({
      where: { schoolId, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, radiusMeters: true },
    }),
    prisma.grade.findMany({
      where: { schoolId, NOT: { dismissalTime: null } },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        level: true,
        dismissalTime: true,
        _count: { select: { students: true } },
      },
    }),
  ]);

  // Agrupar por hora de salida
  const bucketsMap = new Map<string, DismissalBucket>();
  for (const g of grades) {
    if (!g.dismissalTime) continue;
    const existing = bucketsMap.get(g.dismissalTime);
    if (existing) {
      if (g.level && !existing.levels.includes(g.level)) existing.levels.push(g.level);
      existing.gradeNames.push(g.name);
      existing.studentsCount += g._count.students;
    } else {
      bucketsMap.set(g.dismissalTime, {
        time: g.dismissalTime,
        levels: g.level ? [g.level] : [],
        gradeNames: [g.name],
        studentsCount: g._count.students,
      });
    }
  }
  const buckets = Array.from(bucketsMap.values()).sort((a, b) =>
    a.time.localeCompare(b.time),
  );

  return (
    <LiveArrivalsBoard
      pickupPoints={pickupPoints}
      role={session.user.role}
      schoolName={null}
      dismissalBuckets={buckets}
    />
  );
}
