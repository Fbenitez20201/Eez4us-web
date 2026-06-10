import { redirect } from 'next/navigation';

import { OperationalReport } from '@/components/admin/operational-report';
import { getCurrentSession } from '@/lib/session';

export default async function OperationalReportPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!['director', 'super_admin'].includes(session.user.role)) redirect('/admin');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Reporte operativo</h1>
        <p className="text-sm text-muted-foreground">
          Alumnos activos, viajes del mes y tendencia 30 días.
        </p>
      </div>
      <OperationalReport isSuper={session.user.role === 'super_admin'} />
    </div>
  );
}
