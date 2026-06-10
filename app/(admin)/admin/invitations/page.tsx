import type { InvitationStatus } from '@prisma/client';
import { Mail } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { type Column,DataTable } from '@/components/admin/data-table';
import { InvitationsFilters } from '@/components/admin/invitations-filters';
import { ResendButton } from '@/components/admin/resend-button';
import { EmptyState } from '@/components/empty-state';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

const PAGE_SIZE = 25;

const VALID_STATUSES: InvitationStatus[] = [
  'PENDING',
  'SENT',
  'CLAIMED',
  'EXPIRED',
  'REVOKED',
];

const STATUS_VARIANTS: Record<InvitationStatus, BadgeProps['variant']> = {
  PENDING: 'warning',
  SENT: 'default',
  CLAIMED: 'success',
  EXPIRED: 'secondary',
  REVOKED: 'destructive',
};

// "Estado" habla del ENVÍO; el registro del padre en la app va aparte (columna Registro).
// Pendiente de envío ≠ enviada ≠ enviada y registrada.
const STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: 'Pendiente de envío',
  SENT: 'Enviada',
  CLAIMED: 'Enviada',
  EXPIRED: 'Expirada',
  REVOKED: 'Revocada',
};

interface InvitationRow {
  id: string;
  contactValue: string;
  channel: 'EMAIL' | 'WHATSAPP';
  status: InvitationStatus;
  recipientName: string | null;
  studentNames: string[];
  createdAt: string;
  claimedAt: string | null;
  expiresAt: string;
  resendable: boolean;
}

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  const schoolId = session.user.schoolId;
  const { page: pageParam, status } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? '1') || 1);
  const statusFilter = VALID_STATUSES.includes(status as InvitationStatus)
    ? (status as InvitationStatus)
    : undefined;

  const where = {
    schoolId,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [total, invitations, byStatus] = await Promise.all([
    prisma.invitation.count({ where }),
    prisma.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        contactValue: true,
        channel: true,
        status: true,
        recipientName: true,
        studentIds: true,
        createdAt: true,
        claimedAt: true,
        expiresAt: true,
      },
    }),
    prisma.invitation.groupBy({
      by: ['status'],
      where: { schoolId },
      _count: { _all: true },
    }),
  ]);

  const countOf = (s: InvitationStatus) =>
    byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const registered = countOf('CLAIMED');
  // Enviadas (o vencidas) cuyo padre todavía no confirmó su registro en la app
  const awaitingRegistration = countOf('SENT') + countOf('EXPIRED');
  const pendingSend = countOf('PENDING');

  const studentIds = [...new Set(invitations.flatMap((i) => i.studentIds))];
  const students = studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds }, schoolId },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const studentMap = new Map(students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

  const rows: InvitationRow[] = invitations.map((i) => ({
    id: i.id,
    contactValue: i.contactValue,
    channel: i.channel,
    status: i.status,
    recipientName: i.recipientName,
    studentNames: i.studentIds.map((sid) => studentMap.get(sid) ?? sid),
    createdAt: i.createdAt.toISOString(),
    claimedAt: i.claimedAt?.toISOString() ?? null,
    expiresAt: i.expiresAt.toISOString(),
    resendable: i.status !== 'CLAIMED' && i.status !== 'REVOKED',
  }));

  const columns: Column<InvitationRow>[] = [
    {
      key: 'contact',
      header: 'Contacto',
      cell: (r) => (
        <div>
          <p className="font-bold">{r.recipientName ?? 'Sin nombre'}</p>
          <p className="text-xs text-muted-foreground">{r.contactValue}</p>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'Canal',
      cell: (r) => (
        <Badge variant={r.channel === 'EMAIL' ? 'default' : 'success'}>{r.channel}</Badge>
      ),
    },
    {
      key: 'students',
      header: 'Alumnos',
      cell: (r) => (
        <div className="space-y-0.5 text-xs">
          {r.studentNames.slice(0, 3).map((n) => (
            <p key={n}>{n}</p>
          ))}
          {r.studentNames.length > 3 && (
            <p className="text-muted-foreground">+{r.studentNames.length - 3} más</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Envío',
      cell: (r) => (
        <Badge variant={STATUS_VARIANTS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
      ),
    },
    {
      key: 'registration',
      header: 'Registro',
      cell: (r) =>
        r.status === 'CLAIMED' ? (
          <div>
            <Badge variant="success">Registrado</Badge>
            {r.claimedAt && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {new Date(r.claimedAt).toLocaleDateString('es')}
              </p>
            )}
          </div>
        ) : r.status === 'REVOKED' ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <Badge variant="warning">Pendiente</Badge>
        ),
    },
    {
      key: 'date',
      header: 'Creada',
      cell: (r) => (
        <span className="font-mono text-xs">
          {new Date(r.createdAt).toLocaleDateString('es')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (r) =>
        r.resendable ? <ResendButton schoolId={schoolId} invitationId={r.id} /> : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Invitaciones</h1>
        <p className="text-sm text-muted-foreground">{total} en total.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Registrados en la app</p>
          <p className="text-3xl font-black text-emerald-600">{registered}</p>
        </div>
        <Link
          href="/admin/invitations?status=SENT"
          className="rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary"
        >
          <p className="text-xs font-bold uppercase text-muted-foreground">
            Falta confirmar registro
          </p>
          <p className="text-3xl font-black text-amber-600">{awaitingRegistration}</p>
          <p className="text-xs text-muted-foreground">Invitados que aún no entraron a la app</p>
        </Link>
        <Link
          href="/admin/invitations?status=PENDING"
          className="rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary"
        >
          <p className="text-xs font-bold uppercase text-muted-foreground">Pendientes de envío</p>
          <p className="text-3xl font-black">{pendingSend}</p>
        </Link>
      </div>

      <InvitationsFilters />
      <DataTable
        rows={rows}
        columns={columns}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        baseUrl="/admin/invitations"
        queryParams={{ status: status }}
        empty={
          status ? (
            <EmptyState
              icon={Mail}
              title="Sin invitaciones con ese estado"
              description="Probá cambiar el filtro arriba."
            />
          ) : (
            <EmptyState
              icon={Mail}
              title="Aún no enviaste invitaciones"
              description="Importá un Excel con padres y alumnos — desde ahí se generan las invitaciones automáticas."
              action={
                <Link href="/admin/students/import">
                  <Button>Importar Excel</Button>
                </Link>
              }
            />
          )
        }
      />
    </div>
  );
}
