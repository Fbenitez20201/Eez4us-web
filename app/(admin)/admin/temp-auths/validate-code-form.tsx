'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { documentTypeLabel } from '@/lib/documents';

interface ValidationResult {
  id: string;
  personName: string;
  documentType: string | null;
  documentId: string | null;
  vehicleInfo: string | null;
  validDate: string;
  parent: { id: string; name: string | null; email: string };
  students: { id: string; firstName: string; lastName: string; grade?: { name: string } | null }[];
}

export function ValidateCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function onValidate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPending(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/temporary-authorizations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(data.authorization);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo validar');
    } finally {
      setPending(false);
    }
  }

  async function onConfirm() {
    if (!result) return;
    if (!confirm(`¿Confirmar entrega a ${result.personName}?`)) return;
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/admin/temporary-authorizations/${result.id}/confirm`,
        { method: 'POST', credentials: 'include' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Entrega confirmada');
      setResult(null);
      setCode('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo confirmar');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Validar código</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onValidate} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="font-mono uppercase tracking-widest"
            maxLength={20}
            required
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Validando…' : 'Validar'}
          </Button>
        </form>

        {result && (
          <div className="rounded-2xl border-2 border-green-200 bg-green-50/40 p-4 space-y-3">
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Persona temporal</p>
              <p className="text-xl font-black">{result.personName}</p>
              {result.documentId && (
                <p className="text-sm">
                  Documento: {documentTypeLabel(result.documentType) ?? 'Doc'} — {result.documentId}
                </p>
              )}
              {result.vehicleInfo && (
                <p className="text-sm">Vehículo: {result.vehicleInfo}</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Padre autorizante</p>
              <p>{result.parent.name ?? result.parent.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground">Niños autorizados</p>
              <ul className="text-sm">
                {result.students.map((s) => (
                  <li key={s.id}>
                    • {s.firstName} {s.lastName}
                    {s.grade ? ` (${s.grade.name})` : ''}
                  </li>
                ))}
              </ul>
            </div>
            <p className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-900">
              Recomendación: pedile a la persona autorizada que pase personalmente con un
              encargado de la escuela — no subir al alumno al vehículo sin verificar identidad.
            </p>
            <Button onClick={onConfirm} disabled={confirming} className="w-full" size="lg">
              {confirming ? 'Confirmando…' : 'Confirmar entrega'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
