import { cn } from '@/lib/utils';

const STYLES: Record<string, { label: string; className: string }> = {
  EN_CAMINO: { label: 'En camino', className: 'bg-blue-50 text-blue-900 border border-blue-200' },
  EN_ZONA: {
    label: 'En la puerta',
    className: 'bg-amber-100 text-amber-900 border border-amber-300',
  },
  ENTREGADO: { label: 'Entregado', className: 'bg-green-50 text-green-900 border border-green-200' },
  CANCELADO: { label: 'Cancelado', className: 'bg-secondary text-muted-foreground border border-border' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STYLES[status] ?? { label: status, className: 'bg-secondary text-foreground border border-border' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        cfg.className,
      )}
    >
      {cfg.label}
    </span>
  );
}
