import { redirect } from 'next/navigation';

import { AdminShell } from '@/components/admin/admin-shell';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

const STAFF_ROLES = new Set(['director', 'support_staff', 'super_admin']);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!STAFF_ROLES.has(session.user.role)) redirect('/login');

  // Cuenta dada de baja por el director: corta el acceso al panel.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true },
  });
  if (me && !me.active) redirect('/login');

  let schoolName: string | null = null;
  let schoolLogo: string | null = null;
  let internalCode: string | null = null;
  let density: 'compact' | 'comfortable' | 'spacious' = 'comfortable';
  let primaryHue = 142;
  let accentHue = 142;
  if (session.user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: session.user.schoolId },
      select: {
        name: true,
        logoUrl: true,
        internalCode: true,
        density: true,
        brandHue: true,
        brandHueSecondary: true,
      },
    });
    schoolName = school?.name ?? null;
    schoolLogo = school?.logoUrl ?? null;
    internalCode = school?.internalCode ?? null;
    if (school?.density === 'compact' || school?.density === 'spacious') {
      density = school.density;
    }
    primaryHue = school?.brandHue ?? 142;
    accentHue = school?.brandHueSecondary ?? school?.brandHue ?? 142;
  }

  // Theming por colegio: primario (chrome/sidebar) + acento (íconos, bandas)
  const brandStyle = {
    ['--primary' as string]: `${primaryHue} 55% 36%`,
    ['--ring' as string]: `${primaryHue} 55% 36%`,
    ['--brand-accent' as string]: `${accentHue} 62% 45%`,
  } as React.CSSProperties;

  return (
    <div
      data-density={density}
      style={brandStyle}
      className="h-screen overflow-hidden bg-background"
    >
      <AdminShell
        userName={session.user.name}
        role={session.user.role}
        schoolName={schoolName}
        schoolLogo={schoolLogo}
        internalCode={internalCode}
      >
        {children}
      </AdminShell>
    </div>
  );
}
