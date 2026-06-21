import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export default async function ImportsPage() {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  if (!['director', 'super_admin'].includes(session.user.role)) redirect('/admin');

  const jobs = await prisma.importJob.findMany({
    where: { schoolId: session.user.schoolId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { name: true, email: true } } },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Importaciones</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de cargas masivas de padres/alumnos.
          </p>
        </div>
        <Link
          href="/admin/students/import"
          className="rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          Nueva importación
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay importaciones registradas.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {jobs.map((j) => (
                <li key={j.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{j.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        Por {j.createdBy.name ?? j.createdBy.email} ·{' '}
                        {new Date(j.createdAt).toLocaleString('es-MX')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="rounded-full bg-secondary px-2 py-1 font-bold">
                        {j.status}
                      </span>
                      <div className="text-right">
                        <p>
                          <span className="text-green-600 font-bold">{j.successRows}</span> ok ·{' '}
                          <span className="text-destructive font-bold">{j.errorRows}</span> err ·{' '}
                          {j.warnings} warn
                        </p>
                        <p className="text-muted-foreground">
                          {j.totalRows} filas total
                        </p>
                      </div>
                    </div>
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
