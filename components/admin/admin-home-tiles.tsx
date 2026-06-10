'use client';

import { ArrowUpRight, GraduationCap, Mailbox, Navigation } from 'lucide-react';
import Link from 'next/link';

type TileIcon = 'students' | 'invitations' | 'trips';

const ICONS: Record<TileIcon, typeof GraduationCap> = {
  students: GraduationCap,
  invitations: Mailbox,
  trips: Navigation,
};

interface Tile {
  label: string;
  value: number;
  href: string;
  hint?: string;
  icon?: TileIcon;
}

interface AdminHomeTilesProps {
  tiles: Tile[];
}

export function AdminHomeTiles({ tiles }: AdminHomeTilesProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => {
        const Icon = t.icon ? ICONS[t.icon] : null;
        return (
          <Link
            key={t.label}
            href={t.href}
            className="group block overflow-hidden rounded-xl border-[1.5px] border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--brand-accent))] hover:shadow-elev"
          >
            {/* Banda de color de acento */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ background: 'hsl(var(--brand-accent) / 0.12)' }}
            >
              {Icon && (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card"
                  style={{
                    borderColor: 'hsl(var(--brand-accent) / 0.45)',
                    color: 'hsl(var(--brand-accent))',
                  }}
                >
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <ArrowUpRight
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                style={{ color: 'hsl(var(--brand-accent))' }}
              />
            </div>

            {/* Cuerpo */}
            <div className="px-5 pb-5 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.label}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums">{t.value}</p>
              {t.hint && <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
