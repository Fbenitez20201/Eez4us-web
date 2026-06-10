'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Sidebar } from '@/components/admin/sidebar';
import { Topbar } from '@/components/admin/topbar';

interface AdminShellProps {
  userName: string | null;
  role: string;
  schoolName: string | null;
  schoolLogo: string | null;
  internalCode: string | null;
  children: React.ReactNode;
}

const COLLAPSE_KEY = 'eez4us.sidebarCollapsed';

export function AdminShell({
  userName,
  role,
  schoolName,
  schoolLogo,
  internalCode,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Cerrar el drawer al navegar
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Recordar el estado colapsado del sidebar (solo escritorio)
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
  }, []);

  // Escape cierra el drawer
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        userName={userName}
        role={role}
        schoolName={schoolName}
        schoolLogo={schoolLogo}
        open={drawerOpen}
        collapsed={collapsed}
        onClose={() => setDrawerOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          schoolName={schoolName}
          internalCode={internalCode}
          collapsed={collapsed}
          onMenuClick={() => setDrawerOpen(true)}
          onToggleCollapse={toggleCollapsed}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl 3xl:max-w-[110rem] shell-px shell-py">{children}</div>
        </main>
      </div>
    </div>
  );
}
