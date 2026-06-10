'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import { Select } from '@/components/ui/select';

const STATUSES = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendientes de envío' },
  { value: 'SENT', label: 'Enviadas sin registrar' },
  { value: 'CLAIMED', label: 'Registradas' },
  { value: 'EXPIRED', label: 'Expiradas' },
  { value: 'REVOKED', label: 'Revocadas' },
];

export function InvitationsFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') ?? '';

  function apply(next: string) {
    const sp = new URLSearchParams();
    if (next) sp.set('status', next);
    sp.set('page', '1');
    router.push(`/admin/invitations?${sp.toString()}`);
  }

  return (
    <Select
      value={status}
      onChange={(e) => apply(e.target.value)}
      className="sm:max-w-xs"
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </Select>
  );
}
