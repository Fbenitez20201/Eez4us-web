import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { RankedTripsBoard } from '@/components/admin/ranked-trips-board';
import { prisma } from '@/lib/db';
import { buildRankedTrips } from '@/lib/pusher-channels';
import { getCurrentSession } from '@/lib/session';

interface PageProps {
  params: Promise<{ pickupPointId: string }>;
}

export default async function PickupDashboardPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  const schoolId = session.user.schoolId;

  const { pickupPointId } = await params;

  const pickup = await prisma.pickupPoint.findUnique({
    where: { id: pickupPointId },
    select: { id: true, schoolId: true, name: true, radiusMeters: true },
  });
  if (!pickup || pickup.schoolId !== schoolId) notFound();

  const initialTrips = await buildRankedTrips(schoolId, pickup.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/dashboard"
            className="text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-3xl font-black">{pickup.name}</h1>
          <p className="text-sm text-muted-foreground">
            Viajes activos rankeados por ETA. Geofence: {pickup.radiusMeters} m.
          </p>
        </div>
      </div>

      <RankedTripsBoard
        initialTrips={initialTrips}
        schoolId={schoolId}
        pickupPointId={pickup.id}
        role={session.user.role}
      />
    </div>
  );
}
