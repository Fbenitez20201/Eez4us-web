'use client';

import { useEffect, useState } from 'react';

import { getPusherClient } from '@/lib/pusher-client';
import { cn } from '@/lib/utils';

type Tone = 'online' | 'connecting' | 'offline';

function toneOf(state: string): Tone {
  if (state === 'connected') return 'online';
  if (state === 'disconnected' || state === 'failed') return 'offline';
  return 'connecting';
}

const LABEL: Record<Tone, string> = {
  online: 'En vivo',
  connecting: 'Conectando',
  offline: 'Sin conexión',
};

const DOT: Record<Tone, string> = {
  online: 'bg-emerald-400',
  connecting: 'bg-amber-400 animate-pulse',
  offline: 'bg-red-500',
};

export function TvConnectionIndicator() {
  const [tone, setTone] = useState<Tone>('connecting');

  useEffect(() => {
    const pusher = getPusherClient();
    const apply = () => setTone(toneOf(pusher.connection.state));
    apply();
    pusher.connection.bind('state_change', apply);
    return () => {
      pusher.connection.unbind('state_change', apply);
    };
  }, []);

  return (
    <span
      className="inline-flex items-center gap-2 text-sm font-bold"
      style={{ color: 'var(--tv-fg2)' }}
    >
      <span className={cn('h-2.5 w-2.5 rounded-full', DOT[tone])} />
      {LABEL[tone]}
    </span>
  );
}
