import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export default async function SchoolsAdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'super_admin') redirect('/admin');

  const schools = await prisma.school.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: true,
      _count: {
        select: {
          users: true,
          students: true,
          pickupPoints: true,
          trips: true,
        },
      },
    },
  });

  const totals = {
    schools: schools.length,
    active: schools.filter((s) => s.active).length,
    students: schools.reduce((acc, s) => acc + s._count.students, 0),
    users: schools.reduce((acc, s) => acc + s._count.users, 0),
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Colegios</h1>
          <p className="text-sm text-muted-foreground">
            Vista global de colegios en la plataforma.
          </p>
        </div>
        <Link href="/admin/schools/new">
          <Button>Alta de colegio</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground font-bold">Colegios</p>
            <p className="text-3xl font-black">{totals.schools}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground font-bold">Activos</p>
            <p className="text-3xl font-black">{totals.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground font-bold">Alumnos</p>
            <p className="text-3xl font-black">{totals.students}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground font-bold">Usuarios</p>
            <p className="text-3xl font-black">{totals.users}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {schools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay colegios cargados.</p>
          ) : (
            <ul className="divide-y text-sm">
              {schools.map((s) => {
                const monthlyRevenue =
                  s.subscription && ['ACTIVE', 'PAST_DUE'].includes(s.subscription.status)
                    ? s._count.students * s.subscription.pricePerStudent
                    : 0;
                const location = [s.city, s.country].filter(Boolean).join(', ');
                return (
                <li key={s.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {s.name}{' '}
                        {location && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {location}
                          </span>
                        )}
                        {!s.active && (
                          <span className="ml-2 rounded-full bg-destructive/20 px-2 py-0.5 text-xs font-bold text-destructive">
                            Suspendido
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Código <code>{s.internalCode}</code> ·{' '}
                        {s._count.students} alumnos · {s._count.users} usuarios ·{' '}
                        {s._count.trips} viajes ·{' '}
                        {s.subscription?.status ?? 'sin suscripción'} ·{' '}
                        <span className="font-bold text-emerald-700">
                          ${monthlyRevenue.toLocaleString('en-US')} /mes
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form
                        action={`/api/admin/schools/${s.id}/impersonate`}
                        method="POST"
                      >
                        <Button type="submit" variant="outline" size="sm">
                          Ver como director
                        </Button>
                      </form>
                      <Link href={`/admin/schools/${s.id}`}>
                        <Button variant="outline" size="sm">
                          Detalle
                        </Button>
                      </Link>
                    </div>
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
