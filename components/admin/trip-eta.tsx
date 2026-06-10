'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface TripETAProps {
  etaSeconds: number | null;
  etaUpdatedAt: string | null;
}

function format(remaining: number): { text: string; arriving: boolean } {
  if (remaining <= 30) return { text: 'Llegando', arriving: true };
  const total = Math.floor(remaining);
  const mins = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, '0');
  return { text: `${mins}:${ss}`, arriving: false };
}

export function TripETA({ etaSeconds, etaUpdatedAt }: TripETAProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (etaSeconds == null || etaUpdatedAt == null) {
    return (
      <span className="inline-flex items-center rounded-md border bg-muted px-2.5 py-1 text-sm font-bold tabular-nums text-muted-foreground">
        —
      </span>
    );
  }

  const updatedAtMs = new Date(etaUpdatedAt).getTime();
  const elapsedSec = Math.max(0, (now - updatedAtMs) / 1000);
  const remaining = Math.max(0, etaSeconds - elapsedSec);
  const { text, arriving } = format(remaining);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-bold tabular-nums',
        arriving
          ? 'bg-amber-100 text-amber-900 border-amber-300'
          : 'bg-secondary text-foreground border-border',
      )}
    >
      {text}
    </span>
  );
}
