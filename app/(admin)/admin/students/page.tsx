import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { type Column,DataTable } from '@/components/admin/data-table';
import { DeleteButton } from '@/components/admin/delete-button';
import { StudentsFilters } from '@/components/admin/students-filters';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

const PAGE_SIZE = 25;

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  externalId: string | null;
  gradeName: string | null;
  parentsCount: number;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; gradeId?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  const schoolId = session.user.schoolId;
  const { page: pageParam, q, gradeId } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? '1') || 1);

  const where = {
    schoolId,
    active: true,
    ...(gradeId ? { gradeId } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { externalId: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [grades, total, students] = await Promise.all([
    prisma.grade.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        externalId: true,
        grade: { select: { name: true } },
        _count: { select: { parents: true } },
      },
    }),
  ]);

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    externalId: s.externalId,
    gradeName: s.grade?.name ?? null,
    parentsCount: s._count.parents,
  }));

  const columns: Column<StudentRow>[] = [
    {
      key: 'name',
      header: 'Alumno',
      cell: (r) => (
        <div>
          <p className="font-bold">
            {r.lastName}, {r.firstName}
          </p>
          {r.externalId && (
            <p className="font-mono text-xs text-muted-foreground">{r.externalId}</p>
          )}
        </div>
      ),
    },
    {
      key: 'grade',
      header: 'Grado',
      cell: (r) =>
        r.gradeName ? (
          <Badge variant="secondary">{r.gradeName}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Sin asignar</span>
        ),
    },
    {
      key: 'parents',
      header: 'Padres',
      cell: (r) => <span>{r.parentsCount}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      cell: (r) => (
        <div className="inline-flex gap-2">
          <Link href={`/admin/students/${r.id}/edit`}>
            <Button variant="outline" size="sm">
              Editar
            </Button>
          </Link>
          <DeleteButton
            url={`/api/schools/${schoolId}/students/${r.id}`}
            description="Se desactiva el alumno. Sus padres ya no podrán crear nuevos viajes para él."
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black">Alumnos</h1>
          <p className="text-sm text-muted-foreground">{total} alumnos activos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/students/import">
            <Button variant="outline">Importar Excel</Button>
          </Link>
          <Link href="/admin/students/new">
            <Button>Nuevo alumno</Button>
          </Link>
        </div>
      </div>

      <StudentsFilters grades={grades} />

      <DataTable
        rows={rows}
        columns={columns}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        baseUrl="/admin/students"
        queryParams={{ q, gradeId }}
        empty={
          q || gradeId ? (
            <EmptyState
              icon={GraduationCap}
              title="Sin alumnos que coincidan"
              description="Probá quitar filtros o cambiar el término de búsqueda."
            />
          ) : (
            <EmptyState
              icon={GraduationCap}
              title="Aún no agregaste alumnos"
              description="Cargá un Excel con la lista de padres + alumnos o creá uno manualmente."
              action={
                <div className="flex gap-2">
                  <Link href="/admin/students/import">
                    <Button variant="outline">Importar Excel</Button>
                  </Link>
                  <Link href="/admin/students/new">
                    <Button>Nuevo alumno</Button>
                  </Link>
                </div>
              }
            />
          )
        }
      />
    </div>
  );
}
