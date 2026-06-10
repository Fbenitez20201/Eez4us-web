import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export default async function SuperDashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'super_admin') redirect('/admin');

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalSchools,
    activeSchools,
    pausedSchools,
    totalStudents,
    activeSubs,
    trialingSubs,
    pastDueSubs,
    activeTrips,
    last7Trips,
    schoolGeo,
    studentsBySchool,
    pushDevices,
    deliveredTrips30d,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { active: true } }),
    prisma.school.count({ where: { active: false } }),
    prisma.student.count({ where: { active: true } }),
    prisma.subscription.findMany({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'TRIALING' } }),
    prisma.subscription.count({ where: { status: 'PAST_DUE' } }),
    prisma.trip.count({ where: { status: { in: ['EN_CAMINO', 'EN_ZONA'] } } }),
    prisma.trip.count({
      where: {
        startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.school.findMany({ select: { city: true, country: true } }),
    prisma.student.groupBy({
      by: ['schoolId'],
      where: { active: true },
      _count: { _all: true },
    }),
    prisma.pushToken.findMany({
      distinct: ['userId', 'platform'],
      select: { platform: true },
    }),
    prisma.trip.findMany({
      where: {
        status: 'ENTREGADO',
        origin: 'EN_CAMINO',
        deliveredAt: { not: null },
        startedAt: { gte: since30d },
      },
      select: { startedAt: true, deliveredAt: true },
    }),
  ]);

  // MRR = alumnos activos × price_per_student por cada colegio con sub activa
  const studentsCountBySchool = new Map(
    studentsBySchool.map((s) => [s.schoolId, s._count._all]),
  );
  const mrr = activeSubs.reduce(
    (acc, s) => acc + (studentsCountBySchool.get(s.schoolId) ?? 0) * s.pricePerStudent,
    0,
  );

  const countries = new Set(schoolGeo.map((s) => s.country).filter(Boolean));
  const cities = new Set(
    schoolGeo.filter((s) => s.city).map((s) => `${s.city}|${s.country ?? ''}`),
  );
  const iosUsers = pushDevices.filter((d) => d.platform === 'ios').length;
  const androidUsers = pushDevices.filter((d) => d.platform === 'android').length;

  const avgPickupMinutes = deliveredTrips30d.length
    ? Math.round(
        deliveredTrips30d.reduce(
          (acc, t) => acc + (t.deliveredAt!.getTime() - t.startedAt.getTime()),
          0,
        ) /
          deliveredTrips30d.length /
          60000 *
          10,
      ) / 10
    : null;

  const stats = [
    { label: 'Colegios totales', value: totalSchools },
    { label: 'Activos', value: activeSchools },
    { label: 'Suspendidos', value: pausedSchools },
    { label: 'Alumnos totales', value: totalStudents },
    { label: 'Países en presencia', value: countries.size },
    { label: 'Ciudades', value: cities.size },
    { label: 'Colegios con sub activa', value: activeSubs.length },
    { label: 'En trial', value: trialingSubs },
    { label: 'Past due', value: pastDueSubs },
    { label: 'Viajes ahora', value: activeTrips },
    { label: 'Viajes últimos 7d', value: last7Trips },
    {
      label: 'Duración prom. recogida (30d)',
      value: avgPickupMinutes == null ? '—' : `${avgPickupMinutes} min`,
    },
    { label: 'Usuarios móviles iOS', value: iosUsers },
    { label: 'Usuarios móviles Android', value: androidUsers },
    { label: 'MRR estimado (USD)', value: `$${mrr.toFixed(0)}` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Super-admin · Dashboard global</h1>
        <p className="text-sm text-muted-foreground">Métricas agregadas de toda la plataforma.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-xs uppercase font-bold text-muted-foreground">{s.label}</p>
              <p className="text-3xl font-black">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Notas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            · MRR estimado = alumnos activos × precio por alumno, sumado por colegio con
            suscripción activa.
          </p>
          <p>
            · Usuarios móviles = padres con dispositivo push registrado, por plataforma. El costo
            de Pusher/Expo escala con este número.
          </p>
          <p>· Países/ciudades salen de la ficha del colegio (editable en su detalle).</p>
          <p>· Stats consultan filas vivas — sin caché. Para uso en escala se denormaliza.</p>
        </CardContent>
      </Card>
    </div>
  );
}
