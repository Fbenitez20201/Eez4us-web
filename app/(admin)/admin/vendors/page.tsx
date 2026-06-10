import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export default async function VendorsPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'super_admin') redirect('/admin');

  const vendors = await prisma.vendor.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, email: true, name: true } },
      enrolledSchools: {
        include: {
          school: {
            select: {
              id: true,
              name: true,
              subscription: { select: { pricePerStudent: true, status: true } },
              _count: { select: { students: { where: { active: true } } } },
            },
          },
        },
      },
    },
  });

  const rows = vendors.map((v) => {
    let monthly = 0;
    let commission = 0;
    for (const es of v.enrolledSchools) {
      const sub = es.school.subscription;
      if (!sub || sub.status === 'CANCELED' || sub.status === 'PAUSED') continue;
      const revenue = es.school._count.students * sub.pricePerStudent;
      monthly += revenue;
      // La comisión corre solo los primeros commissionMonths periodos desde el enroll
      if (v.commissionMonths != null) {
        const expires = new Date(es.enrolledAt);
        expires.setMonth(expires.getMonth() + v.commissionMonths);
        if (expires <= new Date()) continue;
      }
      commission += revenue * v.commissionPct;
    }
    return {
      id: v.id,
      email: v.user.email,
      name: v.user.name ?? '—',
      commissionPct: v.commissionPct,
      commissionMonths: v.commissionMonths,
      schools: v.enrolledSchools.length,
      monthly,
      commission,
      active: v.active,
    };
  });

  const totalCommission = rows.reduce((acc, r) => acc + r.commission, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Agentes de venta</h1>
          <p className="text-sm text-muted-foreground">
            Comisión calculada sobre facturación mensual de las escuelas que enrolaron.
          </p>
        </div>
        <Link href="/admin/vendors/new">
          <Button>Crear agente de venta</Button>
        </Link>
      </div>

      <Card className="shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agente de venta</TableHead>
              <TableHead>Comisión</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Escuelas</TableHead>
              <TableHead className="text-right">Facturación/mes</TableHead>
              <TableHead className="text-right">Comisión/mes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Aún no hay agentes de venta.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-bold">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </TableCell>
                  <TableCell>{(r.commissionPct * 100).toFixed(0)}%</TableCell>
                  <TableCell>
                    {r.commissionMonths
                      ? `${r.commissionMonths} ${r.commissionMonths === 1 ? 'mes' : 'meses'}`
                      : 'Sin límite'}
                  </TableCell>
                  <TableCell>{r.schools}</TableCell>
                  <TableCell className="text-right font-mono">
                    ${r.monthly.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    ${r.commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))
            )}
            {rows.length > 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-right font-bold">
                  Total
                </TableCell>
                <TableCell className="text-right font-mono font-black text-primary">
                  ${totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
