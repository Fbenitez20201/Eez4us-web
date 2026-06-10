'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';

import { useEncryptedChannel } from '@/lib/pusher-subscribe';
import type { RosterEntry, RosterProximity } from '@/lib/trip-types';
import { cn } from '@/lib/utils';

import { ProximityPill } from './proximity-pill';
import { TvEta } from './tv-eta';
import { usePageRotation } from './use-page-rotation';

interface TvGateBoardProps {
  initialEntries: RosterEntry[];
  schoolId: string;
  pickupPointId: string;
  vertical?: boolean;
}

const ORDER: RosterProximity[] = ['EN_PUERTA', 'CERCA', 'EN_CAMINO'];

function compareEntries(a: RosterEntry, b: RosterEntry): number {
  const ae = a.etaSeconds ?? Number.MAX_SAFE_INTEGER;
  const be = b.etaSeconds ?? Number.MAX_SAFE_INTEGER;
  if (ae !== be) return ae - be;
  return a.student.lastName.localeCompare(b.student.lastName);
}

export function TvGateBoard({ initialEntries, schoolId, pickupPointId, vertical = false }: TvGateBoardProps) {
  const [entries, setEntries] = useState<RosterEntry[]>(initialEntries);

  const channelName = useMemo(
    () => `private-encrypted-school-${schoolId}-pickup-${pickupPointId}`,
    [schoolId, pickupPointId],
  );

  const handleRoster = useCallback((data: unknown) => {
    const payload = data as { entries?: RosterEntry[] } | undefined;
    if (!payload?.entries) return;
    setEntries(payload.entries);
  }, []);

  useEncryptedChannel(channelName, { 'roster.update': handleRoster });

  // Lista plana ordenada por cercanía para poder paginar; el header de grupo se
  // dibuja cuando cambia la proximidad dentro de la página.
  const flat = useMemo(
    () =>
      ORDER.flatMap((proximity) =>
        entries.filter((e) => e.proximity === proximity).sort(compareEntries),
      ),
    [entries],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        ORDER.map((p) => [p, entries.filter((e) => e.proximity === p).length]),
      ) as Record<RosterProximity, number>,
    [entries],
  );

  const pageSize = vertical ? 9 : 6;
  const totalPages = Math.max(1, Math.ceil(flat.length / pageSize));
  const page = usePageRotation(totalPages);

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <p className="text-4xl font-black" style={{ color: 'var(--tv-fg2)' }}>
          Sin alumnos pendientes
        </p>
        <p className="mt-3 text-xl" style={{ color: 'var(--tv-fg3)' }}>
          Los alumnos en camino aparecerán acá ordenados por cercanía.
        </p>
      </div>
    );
  }

  const nameSize = vertical ? 'text-4xl' : 'text-5xl';
  const visible = flat.slice(page * pageSize, (page + 1) * pageSize);

  // Reagrupa SOLO lo visible en esta página, preservando los headers de sección.
  const visibleGroups = ORDER.map((proximity) => ({
    proximity,
    items: visible.filter((e) => e.proximity === proximity),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col gap-6">
      {visibleGroups.map((group) => (
        <section key={group.proximity} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <ProximityPill proximity={group.proximity} className="px-4 py-1.5 text-base" />
            <span className="text-base font-bold" style={{ color: 'var(--tv-fg3)' }}>
              {counts[group.proximity]}
            </span>
          </div>

          <AnimatePresence initial={false}>
            {group.items.map((entry) => {
              const atGate = entry.proximity === 'EN_PUERTA';
              return (
                <motion.div
                  key={`${entry.tripId}-${entry.student.id}`}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  className="flex items-center gap-6 rounded-3xl border px-6 py-4"
                  style={{
                    background: atGate ? 'var(--tv-surface-hi)' : 'var(--tv-surface)',
                    borderColor: atGate ? 'var(--tv-border-hi)' : 'var(--tv-border)',
                  }}
                >
                  {atGate && (
                    <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                  )}

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('truncate font-black', nameSize)} style={{ color: 'var(--tv-fg)' }}>
                      {entry.student.firstName} {entry.student.lastName}
                    </span>
                    <div className="mt-1 flex items-center gap-3 text-lg" style={{ color: 'var(--tv-fg2)' }}>
                      {entry.student.grade && <span>{entry.student.grade.name}</span>}
                      {entry.student.grade && <span style={{ color: 'var(--tv-fg3)' }}>·</span>}
                      <span className="truncate">
                        {entry.pickupBy.name}
                        {entry.pickupBy.relationship ? ` (${entry.pickupBy.relationship})` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-6">
                    {entry.vehicle ? (
                      <span className="inline-flex items-center gap-2 text-lg">
                        <span
                          className="inline-block h-4 w-4 rounded-full border"
                          style={{ backgroundColor: entry.vehicle.color, borderColor: 'var(--tv-border)' }}
                        />
                        <span className="font-mono font-bold tracking-wide" style={{ color: 'var(--tv-fg)' }}>
                          {entry.vehicle.plate}
                        </span>
                      </span>
                    ) : (
                      <span className="text-lg" style={{ color: 'var(--tv-fg2)' }}>
                        Retiro en puerta · a pie
                      </span>
                    )}
                    {!atGate && <TvEta etaSeconds={entry.etaSeconds} className="text-3xl" />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      ))}

      {totalPages > 1 && (
        <p className="mt-auto pt-1 text-center text-lg font-bold" style={{ color: 'var(--tv-fg3)' }}>
          Página {page + 1} de {totalPages} · {flat.length} alumnos pendientes
        </p>
      )}
    </div>
  );
}
