'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface User {
  id: string;
  email: string;
  name: string | null;
}

export function NewVendorForm({ candidateUsers }: { candidateUsers: User[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<'existing' | 'new'>(
    candidateUsers.length > 0 ? 'existing' : 'new',
  );
  const [userId, setUserId] = useState(candidateUsers[0]?.id ?? '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [commissionPct, setCommissionPct] = useState('10');
  const [commissionMonths, setCommissionMonths] = useState('3');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const pct = Number(commissionPct) / 100;
      if (Number.isNaN(pct) || pct < 0 || pct > 1) {
        setError('Comisión inválida');
        return;
      }
      // vacío = sin límite de meses
      const months = commissionMonths.trim() === '' ? null : Number(commissionMonths);
      if (months !== null && (!Number.isInteger(months) || months < 1 || months > 60)) {
        setError('Duración inválida (1 a 60 meses, o vacío para sin límite)');
        return;
      }
      const body =
        mode === 'existing'
          ? { userId, commissionPct: pct, commissionMonths: months }
          : { email, name, commissionPct: pct, commissionMonths: months };
      try {
        const res = await fetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          setError(data?.error ?? `HTTP ${res.status}`);
          return;
        }
        router.push('/admin/vendors');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'existing' ? 'default' : 'outline'}
          onClick={() => setMode('existing')}
          disabled={candidateUsers.length === 0}
        >
          Usuario existente
        </Button>
        <Button
          type="button"
          variant={mode === 'new' ? 'default' : 'outline'}
          onClick={() => setMode('new')}
        >
          Crear usuario nuevo
        </Button>
      </div>

      {mode === 'existing' ? (
        <div className="space-y-2">
          <Label htmlFor="userId">Usuario</Label>
          <Select id="userId" value={userId} onChange={(e) => setUserId(e.target.value)} required>
            {candidateUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email} ({u.email})
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="commission">Comisión (%)</Label>
          <Input
            id="commission"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={commissionPct}
            onChange={(e) => setCommissionPct(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="commissionMonths">Duración (meses)</Label>
          <Input
            id="commissionMonths"
            type="number"
            min="1"
            max="60"
            step="1"
            value={commissionMonths}
            onChange={(e) => setCommissionMonths(e.target.value)}
            placeholder="Vacío = sin límite"
          />
          <p className="text-xs text-muted-foreground">
            Ej: 10% por 3 meses — la comisión se acumula en los siguientes {commissionMonths || 'N'}{' '}
            periodos de pago de cada escuela enrolada.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm font-bold text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creando…' : 'Crear agente de venta'}
        </Button>
      </div>
    </form>
  );
}
