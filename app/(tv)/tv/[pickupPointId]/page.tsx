import { notFound, redirect } from 'next/navigation';

import { TvArrivalsBoard } from '@/components/tv/tv-arrivals-board';
import { TvKioskShell } from '@/components/tv/tv-kiosk-shell';
import { prisma } from '@/lib/db';
import { buildRankedTrips } from '@/lib/pusher-channels';
import { GATE_ROLES } from '@/lib/roster';
import { getCurrentSession } from '@/lib/session';

interface PageProps {
  params: Promise<{ pickupPointId: string }>;
  searchParams: Promise<{ theme?: string; orientation?: string }>;
}

export default async function TvArrivalsPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  if (!GATE_ROLES.includes(session.user.role)) redirect('/login');
  const schoolId = session.user.schoolId;

  const { pickupPointId } = await params;
  const sp = await searchParams;
  const theme = sp.theme === 'light' ? 'light' : 'dark';
  const vertical = sp.orientation === 'vertical';

  const [pickup, school] = await Promise.all([
    prisma.pickupPoint.findUnique({
      where: { id: pickupPointId },
      select: { id: true, schoolId: true, name: true },
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    }),
  ]);
  if (!pickup || pickup.schoolId !== schoolId) notFound();

  const initialTrips = await buildRankedTrips(schoolId, pickup.id);

  return (
    <TvKioskShell schoolName={school?.name ?? null} pickupName={pickup.name} view="arrivals" theme={theme}>
      <TvArrivalsBoard
        initialTrips={initialTrips}
        schoolId={schoolId}
        pickupPointId={pickup.id}
        vertical={vertical}
      />
    </TvKioskShell>
  );
}
