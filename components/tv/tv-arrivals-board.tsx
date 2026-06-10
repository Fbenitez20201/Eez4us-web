'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';

import { useEncryptedChannel } from '@/lib/pusher-subscribe';
import type { RankedTrip } from '@/lib/trip-types';
import { cn } from '@/lib/utils';

import { TvEta } from './tv-eta';
import { usePageRotation } from './use-page-rotation';

interface TvArrivalsBoardProps {
  initialTrips: RankedTrip[];
  schoolId: string;
  pickupPointId: string;
  vertical?: boolean;
}

function compareTrips(a: RankedTrip, b: RankedTrip): number {
  const ae = a.etaSeconds ?? Number.MAX_SAFE_INTEGER;
  const be = b.etaSeconds ?? Number.MAX_SAFE_INTEGER;
  if (ae !== be) return ae - be;
  return a.tripId.localeCompare(b.tripId);
}

export function TvArrivalsBoard({ initialTrips, schoolId, pickupPointId, vertical = false }: TvArrivalsBoardProps) {
  const [trips, setTrips] = useState<RankedTrip[]>(() => [...initialTrips].sort(compareTrips));

  const channelName = useMemo(
    () => `private-encrypted-school-${schoolId}-pickup-${pickupPointId}`,
    [schoolId, pickupPointId],
  );

  const handleRanked = useCallback((data: unknown) => {
    const payload = data as { trips?: RankedTrip[] } | undefined;
    if (!payload?.trips) return;
    setTrips([...payload.trips].sort(compareTrips));
  }, []);

  useEncryptedChannel(channelName, { 'trips.ranked': handleRanked });

  const maxRows = vertical ? 12 : 8;
  const totalPages = Math.max(1, Math.ceil(trips.length / maxRows));
  const page = usePageRotation(totalPages);

  if (trips.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-4xl font-black" style={{ color: 'var(--tv-fg2)' }}>
          No hay vehículos en camino
        </p>
        <p className="mt-3 text-xl" style={{ color: 'var(--tv-fg3)' }}>
          Cuando un padre presione “voy en camino” aparecerá acá.
        </p>
      </div>
    );
  }

  const visible = trips.slice(page * maxRows, (page + 1) * maxRows);
  const plateSize = vertical ? 'text-6xl' : 'text-7xl';
  const etaSize = vertical ? 'text-5xl' : 'text-6xl';

  return (
    <div className="flex h-full flex-col gap-3">
      <AnimatePresence initial={false}>
        {visible.map((trip, idx) => {
          const inZone = trip.status === 'EN_ZONA';
          return (
            <motion.div
              key={trip.tripId}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="flex items-center gap-6 rounded-3xl border px-6 py-4"
              style={{
                background: inZone ? 'var(--tv-surface-hi)' : 'var(--tv-surface)',
                borderColor: inZone ? 'var(--tv-border-hi)' : 'var(--tv-border)',
              }}
            >
              <div
                className={cn('w-12 shrink-0 text-center font-black', vertical ? 'text-3xl' : 'text-4xl')}
                style={{ color: 'var(--tv-fg3)' }}
              >
                {page * maxRows + idx + 1}
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                {trip.vehicle ? (
                  <span className={cn('font-mono font-black tracking-wider', plateSize)} style={{ color: 'var(--tv-fg)' }}>
                    {trip.vehicle.plate}
                  </span>
                ) : (
                  <span
                    className={cn('font-black uppercase tracking-wide', vertical ? 'text-4xl' : 'text-5xl')}
                    style={{ color: 'var(--tv-fg2)' }}
                  >
                    {trip.origin === 'ESTOY_AFUERA' ? 'Afuera' : 'A pie'}
                  </span>
                )}
                <div className="mt-2 flex items-center gap-3 text-lg" style={{ color: 'var(--tv-fg2)' }}>
                  {trip.vehicle && (
                    <>
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border"
                        style={{ backgroundColor: trip.vehicle.color, borderColor: 'var(--tv-border)' }}
                      />
                      <span>{trip.vehicle.model}</span>
                      <span style={{ color: 'var(--tv-fg3)' }}>·</span>
                    </>
                  )}
                  <span className="truncate">
                    {trip.students.map((s) => `${s.firstName} ${s.lastName}`).join(' · ')}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <TvEta etaSeconds={trip.etaSeconds} etaUpdatedAt={trip.etaUpdatedAt} className={etaSize} />
                <span
                  className="rounded-lg px-3 py-1 text-base font-black uppercase tracking-wide"
                  style={
                    inZone
                      ? { background: 'var(--tv-emerald-chip)', color: 'var(--tv-emerald)' }
                      : { background: 'var(--tv-sky-chip)', color: 'var(--tv-sky)' }
                  }
                >
                  {inZone ? 'En puerta' : 'En camino'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {totalPages > 1 && (
        <p className="pt-1 text-center text-lg font-bold" style={{ color: 'var(--tv-fg3)' }}>
          Página {page + 1} de {totalPages} · {trips.length} en total
        </p>
      )}
    </div>
  );
}
