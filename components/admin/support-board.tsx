'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type TicketType = 'BUG' | 'IMPROVEMENT' | 'SUPPORT';
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

interface Ticket {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  reportedBy: { id: string; name: string | null; email: string };
  school?: { id: string; name: string } | null;
}

const TYPE_BADGE: Record<
  TicketType,
  { label: string; variant: 'default' | 'destructive' | 'warning' | 'secondary' }
> = {
  BUG: { label: 'Bug', variant: 'destructive' },
  IMPROVEMENT: { label: 'Mejora', variant: 'warning' },
  SUPPORT: { label: 'Soporte', variant: 'secondary' },
};

const STATUS_BADGE: Record<
  TicketStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'secondary' }
> = {
  OPEN: { label: 'Abierto', variant: 'default' },
  IN_PROGRESS: { label: 'En curso', variant: 'warning' },
  RESOLVED: { label: 'Resuelto', variant: 'success' },
  CLOSED: { label: 'Cerrado', variant: 'secondary' },
};

interface SupportBoardProps {
  scope: 'mine' | 'all';
  canAdmin: boolean;
}

export function SupportBoard({ scope, canAdmin }: SupportBoardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [openCreate, setOpenCreate] = useState(false);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ scope });
    if (statusFilter) qs.set('status', statusFilter);
    fetch(`/api/support-tickets?${qs.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ tickets: Ticket[] }>;
      })
      .then((d) => setTickets(d.tickets))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  }, [scope, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: TicketStatus) {
    try {
      const res = await fetch(`/api/support-tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {canAdmin && (
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-44"
            >
              <option value="">Todos los estados</option>
              <option value="OPEN">Abiertos</option>
              <option value="IN_PROGRESS">En curso</option>
              <option value="RESOLVED">Resueltos</option>
              <option value="CLOSED">Cerrados</option>
            </Select>
          )}
        </div>
        <Button onClick={() => setOpenCreate(true)}>Reportar</Button>
      </div>

      {error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive">
          {error}
        </p>
      )}

      <Card className="shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Título</TableHead>
              {canAdmin && <TableHead>Reportado por</TableHead>}
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              {canAdmin && <TableHead className="text-right">Cambiar</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canAdmin ? 6 : 4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No hay tickets.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => {
                const tb = TYPE_BADGE[t.type];
                const sb = STATUS_BADGE[t.status];
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant={tb.variant}>{tb.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold">{t.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {t.description}
                      </div>
                    </TableCell>
                    {canAdmin && (
                      <TableCell className="text-xs">
                        <div className="font-bold">{t.reportedBy.name ?? '—'}</div>
                        <div className="text-muted-foreground">{t.reportedBy.email}</div>
                        {t.school && (
                          <div className="text-muted-foreground">{t.school.name}</div>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString('es-MX')}
                    </TableCell>
                    {canAdmin && (
                      <TableCell className="text-right">
                        <Select
                          value={t.status}
                          onChange={(e) => updateStatus(t.id, e.target.value as TicketStatus)}
                          className="h-9 w-36"
                        >
                          <option value="OPEN">Abierto</option>
                          <option value="IN_PROGRESS">En curso</option>
                          <option value="RESOLVED">Resuelto</option>
                          <option value="CLOSED">Cerrado</option>
                        </Select>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <CreateTicketDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onCreated={() => {
          setOpenCreate(false);
          load();
        }}
      />
    </div>
  );
}

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function CreateTicketDialog({ open, onOpenChange, onCreated }: CreateDialogProps) {
  const [type, setType] = useState<TicketType>('BUG');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, description }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setTitle('');
      setDescription('');
      setType('BUG');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Reportar ticket</DialogTitle>
        <DialogDescription>
          Contanos el problema, sugerencia o pedido. El equipo lo verá inmediatamente.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="t-type">Tipo</Label>
          <Select
            id="t-type"
            value={type}
            onChange={(e) => setType(e.target.value as TicketType)}
          >
            <option value="BUG">Bug</option>
            <option value="IMPROVEMENT">Mejora</option>
            <option value="SUPPORT">Soporte</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-title">Título</Label>
          <Input
            id="t-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={140}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-desc">Descripción</Label>
          <Textarea
            id="t-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            required
            minLength={3}
            maxLength={4000}
          />
        </div>
        {error && (
          <p className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
