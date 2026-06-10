'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { ResendButton } from '@/components/admin/resend-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface Grade {
  id: string;
  name: string;
}

interface Rep {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface ExistingRep {
  id: string;
  name: string | null;
  email: string | null;
  phoneE164: string | null;
}

interface PendingInvitation {
  id: string;
  recipientName: string | null;
  channel: 'EMAIL' | 'WHATSAPP';
  contactValue: string;
  status: string;
  sentAt: string | null;
}

interface StudentFormProps {
  schoolId: string;
  studentId?: string;
  grades: Grade[];
  initial: {
    firstName: string;
    lastName: string;
    gradeId: string | null;
    externalId: string | null;
    birthDate: string | null;
    pickupMode: 'PRIVATE_VEHICLE' | 'TRANSPORT';
    transportName: string | null;
    transportPlate: string | null;
    transportPhone: string | null;
    transportVehicleType: 'BUS' | 'VAN' | null;
  };
  existingReps?: ExistingRep[];
  pendingInvitations?: PendingInvitation[];
}

const emptyRep: Rep = { firstName: '', lastName: '', email: '', phone: '' };

interface RepPayloadResponse {
  invitations?: { createdCount: number; sentCount: number };
  repErrors?: Array<{ rep: string; reason: string }>;
}

function repToPayload(r: Rep) {
  return {
    firstName: r.firstName.trim(),
    lastName: r.lastName.trim(),
    email: r.email.trim() || null,
    phoneE164: r.phone.trim() || null,
  };
}

function toastInvitations(data: RepPayloadResponse, created: number, sent: number) {
  if (created > 0) {
    toast.success(`${sent}/${created} invitaciones enviadas`);
  }
  if (data.repErrors && data.repErrors.length > 0) {
    toast.error(
      `${data.repErrors.length} invitación(es) sin enviar — revisá la lista de invitaciones`,
    );
  }
}

export function StudentForm({
  schoolId,
  studentId,
  grades,
  initial,
  existingReps = [],
  pendingInvitations = [],
}: StudentFormProps) {
  const router = useRouter();
  const isEdit = Boolean(studentId);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [gradeId, setGradeId] = useState(initial.gradeId ?? '');
  const [externalId, setExternalId] = useState(initial.externalId ?? '');
  const [birthDate, setBirthDate] = useState(initial.birthDate?.slice(0, 10) ?? '');
  const [pickupMode, setPickupMode] = useState<'PRIVATE_VEHICLE' | 'TRANSPORT'>(initial.pickupMode);
  const [transportName, setTransportName] = useState(initial.transportName ?? '');
  const [transportPlate, setTransportPlate] = useState(initial.transportPlate ?? '');
  const [transportPhone, setTransportPhone] = useState(initial.transportPhone ?? '');
  const [transportVehicleType, setTransportVehicleType] = useState<'' | 'BUS' | 'VAN'>(
    initial.transportVehicleType ?? '',
  );
  const [reps, setReps] = useState<Rep[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRep() {
    setReps((r) => [...r, { ...emptyRep }]);
  }
  function removeRep(index: number) {
    setReps((r) => r.filter((_, i) => i !== index));
  }
  function updateRep(index: number, field: keyof Rep, value: string) {
    setReps((r) => r.map((rep, i) => (i === index ? { ...rep, [field]: value } : rep)));
  }

  function validateReps(): string | null {
    for (const rep of reps) {
      if (!rep.firstName.trim() || !rep.lastName.trim()) {
        return 'Cada representante necesita nombre y apellido.';
      }
      if (!rep.email.trim() && !rep.phone.trim()) {
        return 'Cada representante necesita email o teléfono.';
      }
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const repError = validateReps();
    if (repError) {
      setError(repError);
      return;
    }

    if (pickupMode === 'TRANSPORT') {
      if (!transportName.trim() || !transportPlate.trim() || !transportVehicleType) {
        setError('Para transporte: responsable, placa y tipo (van/bus) son obligatorios.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const isTransport = pickupMode === 'TRANSPORT';
      const studentBody = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gradeId: gradeId || null,
        externalId: externalId.trim() || null,
        birthDate: birthDate ? new Date(birthDate).toISOString() : null,
        pickupMode,
        transportName: isTransport ? transportName.trim() || null : null,
        transportPlate: isTransport ? transportPlate.trim() || null : null,
        transportPhone: isTransport ? transportPhone.trim() || null : null,
        transportVehicleType: isTransport ? transportVehicleType || null : null,
      };

      if (isEdit) {
        const res = await fetch(`/api/schools/${schoolId}/students/${studentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(studentBody),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? 'No se pudo guardar');
          return;
        }

        if (reps.length > 0) {
          const repRes = await fetch(
            `/api/schools/${schoolId}/students/${studentId}/representatives`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ representatives: reps.map(repToPayload) }),
            },
          );
          if (repRes.ok) {
            const data = (await repRes.json()) as RepPayloadResponse;
            toastInvitations(
              data,
              data.invitations?.createdCount ?? 0,
              data.invitations?.sentCount ?? 0,
            );
          } else {
            const data = (await repRes.json().catch(() => ({}))) as { error?: string };
            toast.error(data.error ?? 'No se pudieron crear las invitaciones');
          }
        }

        toast.success('Cambios guardados');
      } else {
        const res = await fetch(`/api/schools/${schoolId}/students`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...studentBody, representatives: reps.map(repToPayload) }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? 'No se pudo guardar');
          return;
        }
        const data = (await res.json()) as RepPayloadResponse;
        const created = data.invitations?.createdCount ?? 0;
        if (created === 0) {
          toast.success('Alumno creado');
        } else {
          toast.success(`Alumno creado · ${data.invitations?.sentCount ?? 0}/${created} invitaciones enviadas`);
        }
        if (data.repErrors && data.repErrors.length > 0) {
          toast.error(
            `${data.repErrors.length} invitación(es) sin enviar — revisá la lista de invitaciones`,
          );
        }
      }

      router.push('/admin/students');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-6 rounded-3xl border bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">Nombre</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Apellido</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gradeId">Grado</Label>
            <Select id="gradeId" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              <option value="">Sin asignar</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="externalId">Matrícula escolar (opcional)</Label>
            <Input
              id="externalId"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="A-0042"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="birthDate">Fecha de nacimiento (opcional)</Label>
          <Input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-black">Modo de recogida</h2>
          <p className="text-sm text-muted-foreground">Cómo se retira al alumno del colegio.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pickupMode">Modo</Label>
          <Select
            id="pickupMode"
            value={pickupMode}
            onChange={(e) => setPickupMode(e.target.value as 'PRIVATE_VEHICLE' | 'TRANSPORT')}
          >
            <option value="PRIVATE_VEHICLE">Vehículo particular (representante)</option>
            <option value="TRANSPORT">Transporte (van / bus)</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            {pickupMode === 'PRIVATE_VEHICLE'
              ? 'El representante lo recoge en su propio vehículo (se registra desde la app del padre).'
              : 'Lo recoge un servicio de transporte. Cargá los datos del responsable.'}
          </p>
        </div>

        {pickupMode === 'TRANSPORT' && (
          <div className="space-y-4 rounded-2xl border bg-secondary/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transportName">Responsable del transporte</Label>
                <Input
                  id="transportName"
                  value={transportName}
                  onChange={(e) => setTransportName(e.target.value)}
                  placeholder="Nombre de quien transporta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportVehicleType">Tipo de vehículo</Label>
                <Select
                  id="transportVehicleType"
                  value={transportVehicleType}
                  onChange={(e) => setTransportVehicleType(e.target.value as '' | 'BUS' | 'VAN')}
                >
                  <option value="">Seleccioná…</option>
                  <option value="VAN">Van</option>
                  <option value="BUS">Bus</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="transportPlate">Placa del vehículo</Label>
                <Input
                  id="transportPlate"
                  value={transportPlate}
                  onChange={(e) => setTransportPlate(e.target.value)}
                  placeholder="ABC-123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportPhone">Teléfono (opcional)</Label>
                <Input
                  id="transportPhone"
                  value={transportPhone}
                  onChange={(e) => setTransportPhone(e.target.value)}
                  placeholder="+52 55 1234 5678"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-black">Representantes</h2>
          <p className="text-sm text-muted-foreground">
            Cada representante recibe una invitación para crear su cuenta. Email tiene prioridad
            sobre WhatsApp.
          </p>
        </div>

        {isEdit && existingReps.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase text-muted-foreground">Con cuenta</h3>
            <ul className="space-y-2">
              {existingReps.map((rep) => (
                <li key={rep.id} className="rounded-2xl border bg-secondary/30 p-3 text-sm">
                  <p className="font-bold">{rep.name ?? 'Representante'}</p>
                  <p className="text-xs text-muted-foreground">
                    {rep.email ?? rep.phoneE164 ?? '—'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isEdit && pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase text-muted-foreground">
              Invitaciones pendientes
            </h3>
            <ul className="space-y-2">
              {pendingInvitations.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-secondary/30 p-3 text-sm"
                >
                  <div>
                    <p className="font-bold">{inv.recipientName ?? 'Representante'}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.channel === 'EMAIL' ? 'Email' : 'WhatsApp'} · {inv.contactValue} ·{' '}
                      {inv.status}
                    </p>
                  </div>
                  <ResendButton schoolId={schoolId} invitationId={inv.id} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {reps.map((rep, index) => (
            <div key={index} className="space-y-4 rounded-2xl border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-muted-foreground">
                  Nuevo representante {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeRep(index)}
                  className="text-sm font-bold text-destructive hover:underline"
                >
                  Quitar
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`rep-${index}-firstName`}>Nombre</Label>
                  <Input
                    id={`rep-${index}-firstName`}
                    value={rep.firstName}
                    onChange={(e) => updateRep(index, 'firstName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rep-${index}-lastName`}>Apellido</Label>
                  <Input
                    id={`rep-${index}-lastName`}
                    value={rep.lastName}
                    onChange={(e) => updateRep(index, 'lastName', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`rep-${index}-email`}>Email</Label>
                  <Input
                    id={`rep-${index}-email`}
                    type="email"
                    value={rep.email}
                    onChange={(e) => updateRep(index, 'email', e.target.value)}
                    placeholder="madre@ejemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rep-${index}-phone`}>Teléfono (WhatsApp)</Label>
                  <Input
                    id={`rep-${index}-phone`}
                    value={rep.phone}
                    onChange={(e) => updateRep(index, 'phone', e.target.value)}
                    placeholder="+52 55 1234 5678"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Email o teléfono es obligatorio.</p>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={addRep}>
          Agregar representante
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/students')}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
