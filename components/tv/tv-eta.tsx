'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface TvEtaProps {
  etaSeconds: number | null;
  etaUpdatedAt?: string | null;
  className?: string;
}

function label(remaining: number): { text: string; arriving: boolean } {
  // "Llegando" en Nunito redonda, sin caps mono — el jefe pidió tipografía menos agresiva
  if (remaining <= 30) return { text: 'Llegando', arriving: true };
  const total = Math.floor(remaining);
  const mins = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, '0');
  return { text: `${mins}:${ss}`, arriving: false };
}

export function TvEta({ etaSeconds, etaUpdatedAt = null, className }: TvEtaProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (etaSeconds == null) {
    return (
      <span className={cn('font-black tabular-nums', className)} style={{ color: 'var(--tv-fg3)' }}>
        —
      </span>
    );
  }

  let remaining = etaSeconds;
  if (etaUpdatedAt != null) {
    const elapsed = Math.max(0, (now - new Date(etaUpdatedAt).getTime()) / 1000);
    remaining = Math.max(0, etaSeconds - elapsed);
  }

  const { text, arriving } = label(remaining);

  return (
    <span
      className={cn('font-black tabular-nums', className)}
      style={{ color: arriving ? 'var(--tv-emerald)' : 'var(--tv-amber)' }}
    >
      {text}
    </span>
  );
}
