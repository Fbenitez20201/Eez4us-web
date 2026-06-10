import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db';
import { GATE_ROLES } from '@/lib/roster';
import { getCurrentSession } from '@/lib/session';

export default async function TvLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!GATE_ROLES.includes(session.user.role)) redirect('/login');

  let density: 'compact' | 'comfortable' | 'spacious' = 'comfortable';
  let primaryHue = 142;
  let accentHue = 142;
  if (session.user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: session.user.schoolId },
      select: { density: true, brandHue: true, brandHueSecondary: true },
    });
    if (school?.density === 'compact' || school?.density === 'spacious') density = school.density;
    primaryHue = school?.brandHue ?? 142;
    accentHue = school?.brandHueSecondary ?? school?.brandHue ?? 142;
  }

  const brandStyle = {
    ['--primary' as string]: `${primaryHue} 55% 36%`,
    ['--ring' as string]: `${primaryHue} 55% 36%`,
    ['--brand-accent' as string]: `${accentHue} 62% 45%`,
  } as React.CSSProperties;

  return (
    <div
      data-density={density}
      style={brandStyle}
      className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-50"
    >
      {children}
    </div>
  );
}
