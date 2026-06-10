import { redirect } from 'next/navigation';

import { FinancialReport } from '@/components/admin/financial-report';
import { getCurrentSession } from '@/lib/session';

export default async function FinancialReportPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'super_admin') redirect('/admin');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Reporte financiero</h1>
        <p className="text-sm text-muted-foreground">
          Facturación recurrente vigente, comisiones a agentes de venta y breakdown por escuela.
        </p>
      </div>
      <FinancialReport />
    </div>
  );
}
