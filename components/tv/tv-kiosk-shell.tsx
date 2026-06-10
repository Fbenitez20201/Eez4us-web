'use client';

import { useEffect } from 'react';

import { TvClock } from './tv-clock';
import { TvConnectionIndicator } from './tv-connection-indicator';
import { TvFullscreenButton } from './tv-fullscreen-button';

export type TvTheme = 'dark' | 'light';

interface TvKioskShellProps {
  schoolName: string | null;
  pickupName: string;
  view: 'arrivals' | 'gate';
  theme?: TvTheme;
  children: React.ReactNode;
}

const VIEW_LABEL: Record<'arrivals' | 'gate', string> = {
  arrivals: 'Llegadas',
  gate: 'Portón',
};

const DARK_VARS = {
  '--tv-bg': '#020617',
  '--tv-surface': '#0f172a',
  '--tv-surface-hi': 'rgb(16 185 129 / 0.10)',
  '--tv-border': '#1e293b',
  '--tv-border-hi': 'rgb(16 185 129 / 0.50)',
  '--tv-btn': '#1e293b',
  '--tv-fg': '#ffffff',
  '--tv-fg2': '#94a3b8',
  '--tv-fg3': '#475569',
  '--tv-amber': '#fcd34d',
  '--tv-emerald': '#6ee7b7',
  '--tv-sky': '#7dd3fc',
  '--tv-emerald-chip': 'rgb(16 185 129 / 0.20)',
  '--tv-sky-chip': 'rgb(14 165 233 / 0.15)',
  '--tv-emerald-pill': 'rgb(16 185 129 / 0.15)',
  '--tv-emerald-pill-bd': 'rgb(16 185 129 / 0.40)',
  '--tv-amber-pill': 'rgb(245 158 11 / 0.15)',
  '--tv-amber-pill-bd': 'rgb(245 158 11 / 0.40)',
  '--tv-sky-pill': 'rgb(14 165 233 / 0.15)',
  '--tv-sky-pill-bd': 'rgb(14 165 233 / 0.40)',
} as unknown as React.CSSProperties;

const LIGHT_VARS = {
  '--tv-bg': '#f6f9fb',
  '--tv-surface': '#ffffff',
  '--tv-surface-hi': '#ecfdf5',
  '--tv-border': '#e2e8f0',
  '--tv-border-hi': '#6ee7b7',
  '--tv-btn': '#f1f5f9',
  '--tv-fg': '#0f172a',
  '--tv-fg2': '#64748b',
  '--tv-fg3': '#94a3b8',
  '--tv-amber': '#b45309',
  '--tv-emerald': '#047857',
  '--tv-sky': '#0369a1',
  '--tv-emerald-chip': '#d1fae5',
  '--tv-sky-chip': '#e0f2fe',
  '--tv-emerald-pill': '#d1fae5',
  '--tv-emerald-pill-bd': '#6ee7b7',
  '--tv-amber-pill': '#fef3c7',
  '--tv-amber-pill-bd': '#fcd34d',
  '--tv-sky-pill': '#e0f2fe',
  '--tv-sky-pill-bd': '#7dd3fc',
} as unknown as React.CSSProperties;

export function TvKioskShell({ schoolName, pickupName, view, theme = 'dark', children }: TvKioskShellProps) {
  useEffect(() => {
    type WakeLockLike = { request(_type: 'screen'): Promise<{ release(): Promise<void> }> };
    const wl = (navigator as { wakeLock?: WakeLockLike }).wakeLock;
    if (!wl) return;

    let sentinel: { release(): Promise<void> } | null = null;

    const acquire = async () => {
      try {
        sentinel = await wl.request('screen');
      } catch {
        // ignore
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, []);

  return (
    <div
      style={theme === 'light' ? LIGHT_VARS : DARK_VARS}
      className="flex h-screen w-screen flex-col bg-[var(--tv-bg)] text-[var(--tv-fg)]"
    >
      <header
        className="flex shrink-0 items-center justify-between gap-4 border-b px-8 py-5"
        style={{ borderColor: 'var(--tv-border)' }}
      >
        <div className="min-w-0">
          <p className="truncate text-2xl font-black tracking-tight">{schoolName ?? 'Colegio'}</p>
          <p
            className="text-base font-bold tracking-[0.06em]"
            style={{ color: 'var(--tv-fg2)' }}
          >
            {VIEW_LABEL[view]} · {pickupName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-6">
          <TvConnectionIndicator />
          <TvClock />
          <TvFullscreenButton />
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-hidden p-8">{children}</main>
    </div>
  );
}
