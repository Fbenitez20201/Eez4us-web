import { notFound, redirect } from 'next/navigation';

import { TvGateBoard } from '@/components/tv/tv-gate-board';
import { TvKioskShell } from '@/components/tv/tv-kiosk-shell';
import { prisma } from '@/lib/db';
import { GATE_ROLES, getPickupRoster } from '@/lib/roster';
import { getCurrentSession } from '@/lib/session';

interface PageProps {
  params: Promise<{ pickupPointId: string }>;
  searchParams: Promise<{ theme?: string; orientation?: string }>;
}

export default async function TvGatePage({ params, searchParams }: PageProps) {
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

  const initialEntries = await getPickupRoster(schoolId, pickup.id);

  return (
    <TvKioskShell schoolName={school?.name ?? null} pickupName={pickup.name} view="gate" theme={theme}>
      <TvGateBoard
        initialEntries={initialEntries}
        schoolId={schoolId}
        pickupPointId={pickup.id}
        vertical={vertical}
      />
    </TvKioskShell>
  );
}
