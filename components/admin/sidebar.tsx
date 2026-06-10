'use client';

import {
  AlertTriangle,
  BarChart3,
  Building2,
  Car,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Mailbox,
  MapPin,
  Settings,
  Shield,
  ShieldCheck,
  Tag,
  UserCog,
  UsersRound,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  roles?: string[];
}

interface NavSection {
  title?: string;
  roles?: string[];
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/admin', label: 'Inicio', icon: Home },
      { href: '/admin/dashboard', label: 'Llegadas en vivo', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Personas',
    items: [
      { href: '/admin/students', label: 'Alumnos', icon: GraduationCap },
      { href: '/admin/grades', label: 'Grados', icon: Tag },
      { href: '/admin/families', label: 'Familias', icon: UsersRound },
      { href: '/admin/vehicles', label: 'Vehículos', icon: Car },
      { href: '/admin/invitations', label: 'Invitaciones', icon: Mailbox },
    ],
  },
  {
    title: 'Operación',
    items: [
      { href: '/admin/pickup-points', label: 'Puntos de recogida', icon: MapPin },
      { href: '/admin/temp-auths', label: 'Autoriz. temporales', icon: KeyRound },
      { href: '/admin/messages', label: 'Mensajería', icon: Mail },
      { href: '/admin/alerts', label: 'Alertas', icon: AlertTriangle },
    ],
  },
  {
    title: 'Reportes',
    roles: ['director', 'super_admin'],
    items: [
      { href: '/admin/imports', label: 'Importaciones', icon: FileSpreadsheet },
      { href: '/admin/reports/operational', label: 'Operativo', icon: BarChart3 },
      { href: '/admin/reports/school', label: 'Escuela', icon: BarChart3 },
      { href: '/admin/reports/invitations', label: 'Invitaciones', icon: BarChart3 },
    ],
  },
  {
    title: 'Colegio',
    roles: ['director', 'super_admin'],
    items: [
      { href: '/admin/staff', label: 'Personal', icon: UserCog },
      { href: '/admin/settings', label: 'Configuración', icon: Settings },
    ],
  },
  {
    title: 'Super admin',
    roles: ['super_admin'],
    items: [
      { href: '/admin/super', label: 'Dashboard global', icon: LayoutDashboard },
      { href: '/admin/schools', label: 'Colegios', icon: Building2 },
      { href: '/admin/audit', label: 'Audit log', icon: ShieldCheck },
    ],
  },
];

interface SidebarProps {
  userName: string | null;
  role: string;
  schoolName: string | null;
  schoolLogo: string | null;
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
}

export function Sidebar({
  userName,
  role,
  schoolName,
  schoolLogo,
  open,
  collapsed,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userOpen, setUserOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userOpen) return;
    function onClick(e: MouseEvent) {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [userOpen]);

  function canSee(roles?: string[]) {
    if (!roles || roles.length === 0) return true;
    return roles.includes(role);
  }

  async function handleLogout() {
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  }

  const userInitials = (userName ?? 'U')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // collapsed solo aplica en escritorio (lg+); en móvil el drawer siempre muestra todo.
  const hideOnCollapse = collapsed ? 'lg:hidden' : '';

  return (
    <>
      {/* Backdrop solo en móvil/tablet cuando el drawer está abierto */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card transition-transform duration-200 ease-out',
          'lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          open ? 'translate-x-0 shadow-pop' : '-translate-x-full',
        )}
      >
        {/* Brand header: logo del colegio si lo tiene, fallback Eez4us */}
        <div
          className={cn(
            'flex items-center gap-3 border-b border-border px-5 py-5',
            collapsed && 'lg:justify-center lg:px-2',
          )}
        >
          {schoolLogo ? (
            <img
              src={schoolLogo}
              alt={schoolName ?? ''}
              className="h-11 w-11 shrink-0 rounded-xl object-contain bg-white border border-border p-0.5"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-black shadow-card">
              {(schoolName ?? 'EZ')
                .split(/\s+/)
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
          )}
          <div className={cn('min-w-0', hideOnCollapse)}>
            <p className="text-sm font-bold leading-tight text-foreground truncate">
              {schoolName ?? 'Eez4us'}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Panel admin
            </p>
          </div>
        </div>

        {/* Nav agrupada */}
        <nav className={cn('flex-1 overflow-y-auto px-3 py-4', collapsed && 'lg:px-2')}>
          {SECTIONS.filter((s) => canSee(s.roles)).map((section, idx) => {
            const items = section.items.filter((it) => canSee(it.roles));
            if (items.length === 0) return null;
            return (
              <div key={idx} className="mb-5">
                {section.title && (
                  <div
                    className={cn(
                      'mb-2 rounded-md border border-primary/20 bg-primary/15 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary',
                      hideOnCollapse,
                    )}
                  >
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      item.href === '/admin'
                        ? pathname === '/admin'
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                          collapsed && 'lg:justify-center lg:px-0',
                          active
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground/75 hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary" />
                        )}
                        <Icon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            active
                              ? 'text-primary'
                              : 'text-muted-foreground group-hover:text-foreground',
                          )}
                        />
                        <span className={cn('truncate', hideOnCollapse)}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Usuario */}
        <div ref={userMenuRef} className="relative border-t border-border">
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            className={cn(
              'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary transition-colors',
              collapsed && 'lg:justify-center lg:px-0',
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-black">
              {userInitials}
            </div>
            <div className={cn('min-w-0 flex-1', hideOnCollapse)}>
              <p className="truncate text-sm font-bold leading-tight">{userName ?? 'Usuario'}</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {role.replace('_', ' ')}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                userOpen ? 'rotate-180' : '',
                hideOnCollapse,
              )}
            />
          </button>
          {userOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 min-w-[12rem] rounded-lg border border-border bg-popover p-1 shadow-pop">
              <Link
                href="/admin/settings"
                onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <Settings className="h-4 w-4" />
                Configuración
              </Link>
              <Link
                href="/privacy"
                target="_blank"
                onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <Shield className="h-4 w-4" />
                Política de privacidad
              </Link>
              <Link
                href="/terms"
                target="_blank"
                onClick={() => setUserOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <FileText className="h-4 w-4" />
                Términos del servicio
              </Link>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>

        {/* Footer minúsculo con marca Eez4us */}
        <div
          className={cn(
            'border-t border-border px-5 py-2.5 flex items-center justify-between',
            hideOnCollapse,
          )}
        >
          <Image
            src="/logo.png"
            alt="Eez4us"
            width={70}
            height={32}
            className="h-auto w-[70px] opacity-60"
          />
          <span className="text-[10px] font-semibold text-muted-foreground">v1.0</span>
        </div>
      </aside>
    </>
  );
}
