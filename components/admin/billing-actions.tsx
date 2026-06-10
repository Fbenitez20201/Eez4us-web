'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';

export function BillingActions({ hasSubscription }: { hasSubscription: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function call(path: string, onSuccess?: (data: unknown) => void) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(path, { method: 'POST' });
        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok) {
          setError((data?.error as string) ?? `HTTP ${res.status}`);
          return;
        }
        onSuccess?.(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    });
  }

  function openPortal() {
    call('/api/billing/portal', (data) => {
      const url = (data as { url?: string } | null)?.url;
      if (url) window.location.href = url;
    });
  }

  function startSubscription() {
    call('/api/billing/start-subscription', () => {
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {hasSubscription ? (
        <Button onClick={openPortal} disabled={isPending}>
          {isPending ? 'Abriendo portal…' : 'Agregar/quitar tarjetas y formas de pago'}
        </Button>
      ) : (
        <Button onClick={startSubscription} disabled={isPending}>
          {isPending ? 'Iniciando…' : 'Iniciar suscripción'}
        </Button>
      )}
      {error && (
        <span className="rounded-2xl bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
