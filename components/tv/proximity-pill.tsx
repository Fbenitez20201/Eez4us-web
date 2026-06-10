import type { RosterProximity } from '@/lib/trip-types';
import { cn } from '@/lib/utils';

const STYLES: Record<RosterProximity, { label: string; bg: string; fg: string; bd: string }> = {
  EN_PUERTA: { label: 'En puerta', bg: 'var(--tv-emerald-pill)', fg: 'var(--tv-emerald)', bd: 'var(--tv-emerald-pill-bd)' },
  CERCA: { label: 'Cerca', bg: 'var(--tv-amber-pill)', fg: 'var(--tv-amber)', bd: 'var(--tv-amber-pill-bd)' },
  EN_CAMINO: { label: 'En camino', bg: 'var(--tv-sky-pill)', fg: 'var(--tv-sky)', bd: 'var(--tv-sky-pill-bd)' },
};

export function ProximityPill({
  proximity,
  className,
}: {
  proximity: RosterProximity;
  className?: string;
}) {
  const cfg = STYLES[proximity];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-black uppercase tracking-wide',
        className,
      )}
      style={{ background: cfg.bg, color: cfg.fg, borderColor: cfg.bd }}
    >
      {cfg.label}
    </span>
  );
}
