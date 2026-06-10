import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

import { SchoolActions } from './school-actions';

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'super_admin') redirect('/admin');

  const school = await prisma.school.findUnique({
    where: { id },
    include: {
      subscription: true,
      users: {
        where: { role: { in: ['director', 'support_staff'] } },
        select: { id: true, name: true, email: true, role: true },
      },
      _count: {
        select: {
          students: true,
          trips: true,
          pickupPoints: true,
          invitations: true,
        },
      },
    },
  });
  if (!school) notFound();

  const [parentsCount, vehiclesCount] = await Promise.all([
    prisma.user.count({ where: { schoolId: id, role: 'parent', active: true } }),
    prisma.vehicle.count({ where: { active: true, parent: { schoolId: id, role: 'parent' } } }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/admin/schools" className="text-sm font-bold text-primary hover:underline">
        ← Volver
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">{school.name}</h1>
          <p className="text-sm text-muted-foreground">
            Código <code>{school.internalCode}</code>
            {(school.city || school.country) && (
              <> · {[school.city, school.country].filter(Boolean).join(', ')}</>
            )}
          </p>
        </div>
        <SchoolActions schoolId={school.id} active={school.active} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { l: 'Alumnos', v: school._count.students },
          { l: 'Padres de familia', v: parentsCount },
          { l: 'Vehículos registrados', v: vehiclesCount },
          { l: 'Viajes', v: school._count.trips },
          { l: 'Pickup points', v: school._count.pickupPoints },
          { l: 'Invitaciones', v: school._count.invitations },
        ].map((c) => (
          <Card key={c.l}>
            <CardContent className="pt-6">
              <p className="text-xs uppercase text-muted-foreground font-bold">{c.l}</p>
              <p className="text-2xl font-black">{c.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Staff</CardTitle>
        </CardHeader>
        <CardContent>
          {school.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin staff configurado.</p>
          ) : (
            <ul className="divide-y text-sm">
              {school.users.map((u) => (
                <li key={u.id} className="py-2">
                  <p className="font-bold">{u.name ?? u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · {u.role}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Suscripción</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {school.subscription ? (
            <>
              <p>
                Estado: <span className="font-bold">{school.subscription.status}</span>
              </p>
              <p>Precio por alumno: ${school.subscription.pricePerStudent} USD</p>
              {school.subscription.currentPeriodEnd && (
                <p>
                  Período actual hasta:{' '}
                  {new Date(school.subscription.currentPeriodEnd).toLocaleDateString('es-AR')}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Sin suscripción.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
