import Link from 'next/link';
import type { ReactNode } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  page: number;
  pageSize: number;
  total: number;
  baseUrl: string;
  queryParams?: Record<string, string | undefined>;
  empty?: ReactNode;
}

function buildHref(
  baseUrl: string,
  page: number,
  extra: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
  }
  params.set('page', String(page));
  return `${baseUrl}?${params.toString()}`;
}

export function DataTable<T>({
  rows,
  columns,
  page,
  pageSize,
  total,
  baseUrl,
  queryParams = {},
  empty,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const [titleColumn, ...restColumns] = columns;

  return (
    <div className="rounded-3xl border bg-card shadow-sm">
      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          {empty ?? 'Sin resultados'}
        </div>
      ) : (
        <>
          {/* Tabla en pantallas anchas */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c.key} className={c.className}>
                      {c.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.className}>
                        {c.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Tarjetas apiladas en teléfono */}
          <div className="divide-y md:hidden">
            {rows.map((row, i) => (
              <div key={i} className="space-y-2.5 p-4">
                {titleColumn && <div className="text-base font-bold">{titleColumn.cell(row)}</div>}
                {restColumns.map((c) =>
                  c.header ? (
                    <div key={c.key} className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                        {c.header}
                      </span>
                      <div className="text-right text-sm">{c.cell(row)}</div>
                    </div>
                  ) : (
                    <div key={c.key} className="flex flex-wrap gap-2 pt-1">
                      {c.cell(row)}
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex items-center justify-between border-t px-4 py-3 text-xs">
        <p className="text-muted-foreground">
          Página {page} de {totalPages} · {total} en total
        </p>
        <div className="flex gap-2">
          <Link
            aria-disabled={!hasPrev}
            tabIndex={hasPrev ? 0 : -1}
            href={hasPrev ? buildHref(baseUrl, page - 1, queryParams) : '#'}
            className={cn(
              'rounded-2xl border-2 px-3 py-2 font-bold transition-colors',
              hasPrev
                ? 'border-input hover:bg-secondary'
                : 'pointer-events-none border-input opacity-40',
            )}
          >
            Anterior
          </Link>
          <Link
            aria-disabled={!hasNext}
            tabIndex={hasNext ? 0 : -1}
            href={hasNext ? buildHref(baseUrl, page + 1, queryParams) : '#'}
            className={cn(
              'rounded-2xl border-2 px-3 py-2 font-bold transition-colors',
              hasNext
                ? 'border-input hover:bg-secondary'
                : 'pointer-events-none border-input opacity-40',
            )}
          >
            Siguiente
          </Link>
        </div>
      </div>
    </div>
  );
}
