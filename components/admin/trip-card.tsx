'use client';

import type { RankedTrip } from '@/lib/trip-types';
import { cn } from '@/lib/utils';

import { FinalizeButton } from './finalize-button';
import { StatusBadge } from './status-badge';
import { TripETA } from './trip-eta';

const STAFF_ROLES = new Set(['director', 'support_staff', 'super_admin']);

interface TripCardProps {
  trip: RankedTrip;
  rank: number;
  role: string;
  onRemove: (tripId: string) => void;
}

export function TripCard({ trip, rank, role, onRemove }: TripCardProps) {
  const inZone = trip.status === 'EN_ZONA';
  const canFinalize = inZone && STAFF_ROLES.has(role);

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors',
        inZone ? 'border-amber-300 bg-amber-50/40' : 'hover:bg-secondary/40',
      )}
    >
      {/* Rank */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-base font-bold text-foreground/70">
        {rank}
      </div>

      {/* ETA */}
      <div className="shrink-0">
        <TripETA etaSeconds={trip.etaSeconds} etaUpdatedAt={trip.etaUpdatedAt} />
      </div>

      {/* Parent + vehicle */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight truncate">
          {trip.parentName ?? 'Padre sin nombre'}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {trip.vehicle ? (
            <>
              <span
                className="inline-flex h-3 w-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: trip.vehicle.color }}
                title={trip.vehicle.color}
                aria-hidden
              />
              <span className="font-mono font-semibold tracking-wide text-foreground">
                {trip.vehicle.plate}
              </span>
              <span>{trip.vehicle.model}</span>
            </>
          ) : (
            <span className="font-medium text-foreground/70">
              {trip.origin === 'ESTOY_AFUERA' ? 'Padre afuera · sin GPS' : 'Retiro en puerta · a pie'}
            </span>
          )}
        </div>
      </div>

      {/* Students */}
      <div className="hidden sm:flex flex-wrap items-center gap-1 max-w-[200px]">
        {trip.students.map((s) => (
          <span
            key={s.id}
            className="inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs font-medium"
          >
            {s.firstName} {s.lastName}
          </span>
        ))}
      </div>

      {/* Status + action */}
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={trip.status} />
        {canFinalize && (
          <FinalizeButton
            tripId={trip.tripId}
            parentName={trip.parentName ?? 'el padre'}
            studentNames={trip.students.map((s) => `${s.firstName} ${s.lastName}`)}
            onRemove={() => onRemove(trip.tripId)}
          />
        )}
      </div>
    </div>
  );
}
