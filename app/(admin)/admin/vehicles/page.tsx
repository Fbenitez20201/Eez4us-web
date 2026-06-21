import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  if (!['director', 'support_staff', 'super_admin'].includes(session.user.role)) redirect('/admin');

  const { q } = await searchParams;
  const search = (q ?? '').trim();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      parent: { schoolId: session.user.schoolId },
      active: true,
      ...(search
        ? {
            OR: [
              { plate: { contains: search, mode: 'insensitive' } },
              { model: { contains: search, mode: 'insensitive' } },
              { parent: { name: { contains: search, mode: 'insensitive' } } },
              { parent: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      parent: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black">Vehículos registrados</h1>
        <p className="text-sm text-muted-foreground">
          Vehículos asociados a los padres del colegio.
        </p>
      </div>

      <form className="flex gap-2" action="" method="get">
        <input
          name="q"
          defaultValue={search}
          placeholder="Buscar por placa, modelo o padre…"
          className="flex h-12 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-2xl border-2 border-input px-4 text-sm font-bold hover:bg-secondary"
        >
          Buscar
        </button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Vehículos ({vehicles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search ? 'No se encontró ningún vehículo.' : 'Aún no hay vehículos registrados.'}
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {vehicles.map((v) => (
                <li key={v.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {v.plate} · {v.model}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Color: {v.color} ·{' '}
                        {v.parent.name ?? v.parent.email}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
