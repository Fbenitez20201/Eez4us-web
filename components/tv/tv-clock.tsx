'use client';

import { useEffect, useState } from 'react';

export function TvClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const text = now
    ? now.toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : '--:--:--';

  return (
    <span className="font-bold tabular-nums" style={{ color: 'var(--tv-fg2)' }}>
      {text}
    </span>
  );
}
