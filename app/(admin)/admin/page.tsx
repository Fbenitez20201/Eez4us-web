import { FileSpreadsheet, MapPin, Tag, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AdminHomeTiles } from '@/components/admin/admin-home-tiles';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export default async function AdminHomePage() {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  const schoolId = session.user.schoolId;

  const pickupCount = await prisma.pickupPoint.count({
    where: { schoolId, active: true },
  });
  if (pickupCount === 0) redirect('/admin/setup');

  const [studentsCount, invitationsPending, tripsActive, tripsInZone, gradesCount] =
    await Promise.all([
      prisma.student.count({ where: { schoolId, active: true } }),
      prisma.invitation.count({
        where: { schoolId, status: { in: ['PENDING', 'SENT'] } },
      }),
      prisma.trip.count({
        where: { schoolId, status: { in: ['EN_CAMINO', 'EN_ZONA'] } },
      }),
      prisma.trip.count({
        where: { schoolId, status: 'EN_ZONA' },
      }),
      prisma.grade.count({ where: { schoolId } }),
    ]);

  const tiles = [
    {
      label: 'Alumnos activos',
      value: studentsCount,
      href: '/admin/students',
      hint: `${gradesCount} grados configurados`,
      icon: 'students' as const,
    },
    {
      label: 'Invitaciones pendientes',
      value: invitationsPending,
      href: '/admin/invitations',
      hint: invitationsPending > 0 ? 'Padres sin claimar' : 'Todo al día',
      icon: 'invitations' as const,
    },
    {
      label: 'Viajes en curso',
      value: tripsActive,
      href: '/admin/dashboard',
      hint: tripsInZone > 0 ? `${tripsInZone} en la puerta` : 'Sin llegadas activas',
      icon: 'trips' as const,
    },
  ];

  const shortcuts = [
    {
      label: 'Importar padres desde Excel',
      href: '/admin/students/import',
      icon: FileSpreadsheet,
      description: 'Carga padres + alumnos masivamente con la plantilla oficial.',
    },
    {
      label: 'Agregar punto de recogida',
      href: '/admin/pickup-points/new',
      icon: MapPin,
      description: 'Define el geofence y horarios de un nuevo acceso.',
    },
    {
      label: 'Gestionar grados',
      href: '/admin/grades',
      icon: Tag,
      description: 'Suma, renombra o elimina grados del colegio.',
    },
    {
      label: 'Nuevo alumno',
      href: '/admin/students/new',
      icon: UserPlus,
      description: 'Alta manual de un alumno y asociación con sus padres.',
    },
  ];

  return (
    <div className="shell-gap">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inicio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen rápido de la actividad del colegio.
        </p>
      </div>

      <AdminHomeTiles tiles={tiles} />

      <div>
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Atajos
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-4 rounded-xl border-[1.5px] border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-elev"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card transition-colors"
                style={{
                  borderColor: 'hsl(var(--brand-accent) / 0.45)',
                  background: 'hsl(var(--brand-accent) / 0.12)',
                  color: 'hsl(var(--brand-accent))',
                }}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold leading-tight">{s.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
