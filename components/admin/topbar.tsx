'use client';

import { Bell, Menu, PanelLeft, PanelLeftClose, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TopbarProps {
  schoolName: string | null;
  internalCode: string | null;
  collapsed: boolean;
  onMenuClick: () => void;
  onToggleCollapse: () => void;
}

export function Topbar({
  schoolName,
  internalCode,
  collapsed,
  onMenuClick,
  onToggleCollapse,
}: TopbarProps) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/alerts?unread=true&limit=1', { credentials: 'include' });
        if (!res.ok) return;
        const data = (await res.json()) as { unreadCount?: number };
        if (!cancelled && typeof data.unreadCount === 'number') setUnread(data.unreadCount);
      } catch {
        // ignore
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur sm:gap-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-secondary lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-secondary lg:inline-flex"
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </button>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-foreground truncate">
          {schoolName ?? 'Eez4us Admin'}
        </p>
        {internalCode && (
          <p className="text-[11px] font-semibold text-muted-foreground">
            Código <span className="font-mono font-bold text-foreground/70">{internalCode}</span>
          </p>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3.5 py-2 w-72 transition-colors focus-within:border-primary focus-within:bg-card">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar alumno, padre…"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <Link
          href="/admin/alerts"
          className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-border bg-card hover:bg-secondary transition-colors"
          aria-label="Alertas"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
