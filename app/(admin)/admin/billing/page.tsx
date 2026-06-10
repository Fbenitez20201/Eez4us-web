import { redirect } from 'next/navigation';

import { BillingActions } from '@/components/admin/billing-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }
> = {
  TRIALING: { label: 'En prueba', variant: 'warning' },
  ACTIVE: { label: 'Activa', variant: 'success' },
  PAST_DUE: { label: 'Pago atrasado', variant: 'destructive' },
  CANCELED: { label: 'Cancelada', variant: 'secondary' },
  PAUSED: { label: 'Pausada', variant: 'secondary' },
};

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  return `${dd}-${mm}-${yy}`;
}

export default async function BillingPage() {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  if (!['director', 'super_admin'].includes(session.user.role)) redirect('/admin');
  const schoolId = session.user.schoolId;

  const [sub, studentCount, school, lastPaidInvoice, invoices] = await Promise.all([
    prisma.subscription.findUnique({ where: { schoolId } }),
    prisma.student.count({ where: { schoolId, active: true } }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, stripeCustomerId: true },
    }),
    prisma.invoice.findFirst({
      where: { schoolId, status: 'PAID' },
      orderBy: { paidAt: 'desc' },
      select: { paidAt: true, amount: true },
    }),
    prisma.invoice.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        paidAt: true,
        pdfUrl: true,
      },
    }),
  ]);

  const pricePerStudent = sub?.pricePerStudent ?? 10;
  const amount = studentCount * pricePerStudent;
  const badge = sub ? STATUS_BADGE[sub.status] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Facturación</h1>
        <p className="text-sm text-muted-foreground">
          Eez4us cobra por alumno activo a la escuela ({school?.name ?? 'tu escuela'}).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardDescription>Estado</CardDescription>
            <div className="pt-2">
              {badge ? (
                <Badge variant={badge.variant}>{badge.label}</Badge>
              ) : (
                <Badge variant="secondary">Sin suscripción</Badge>
              )}
            </div>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardDescription>Pago mensual a Eez4us</CardDescription>
            <CardTitle className="text-4xl text-primary">
              ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {studentCount} alumnos × ${pricePerStudent}/mes
            </p>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardDescription>Fecha de corte</CardDescription>
            <CardTitle className="text-2xl">{fmtDate(sub?.currentPeriodEnd ?? null)}</CardTitle>
            <p className="text-xs text-muted-foreground">Cierre del periodo actual</p>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardDescription>Último pago</CardDescription>
            <CardTitle className="text-2xl">{fmtDate(lastPaidInvoice?.paidAt ?? null)}</CardTitle>
            {lastPaidInvoice && (
              <p className="text-xs text-muted-foreground">
                ${lastPaidInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            )}
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Acciones</CardTitle>
          <CardDescription>
            {sub
              ? 'Administrá tu suscripción y método de pago vía el portal de Stripe.'
              : 'Iniciá la suscripción para empezar a cobrar mensualmente por alumno activo.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingActions hasSubscription={!!sub?.stripeSubscriptionId} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay facturas emitidas.</p>
          ) : (
            <ul className="divide-y text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold">
                      ${inv.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Emitida {fmtDate(inv.createdAt)}
                      {inv.paidAt ? ` · Pagada ${fmtDate(inv.paidAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        inv.status === 'PAID'
                          ? 'success'
                          : inv.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {inv.status === 'PAID'
                        ? 'Pagada'
                        : inv.status === 'FAILED'
                          ? 'Falló'
                          : inv.status === 'VOID'
                            ? 'Anulada'
                            : 'Pendiente'}
                    </Badge>
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        PDF
                      </a>
                    )}
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
