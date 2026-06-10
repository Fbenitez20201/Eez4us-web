'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NewSchoolForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [directorPassword, setDirectorPassword] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          internalCode,
          city: city || undefined,
          country: country || undefined,
          director: { name: directorName, email: directorEmail, password: directorPassword },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? `HTTP ${res.status}`);
        return;
      }
      toast.success('Colegio creado');
      router.push(`/admin/schools/${data.school.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>Nombre del colegio</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label>Código interno (único)</Label>
        <Input
          value={internalCode}
          onChange={(e) => setInternalCode(e.target.value.toUpperCase())}
          placeholder="EJ. ABC123"
          required
          className="font-mono uppercase"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Ciudad</Label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Monterrey" />
        </div>
        <div>
          <Label>País</Label>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="México" />
        </div>
      </div>
      <hr className="my-4" />
      <p className="text-sm font-bold uppercase text-muted-foreground">Director inicial</p>
      <div>
        <Label>Nombre</Label>
        <Input value={directorName} onChange={(e) => setDirectorName(e.target.value)} required />
      </div>
      <div>
        <Label>Email</Label>
        <Input
          type="email"
          value={directorEmail}
          onChange={(e) => setDirectorEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <Label>Contraseña inicial</Label>
        <Input
          type="text"
          value={directorPassword}
          onChange={(e) => setDirectorPassword(e.target.value)}
          minLength={8}
          required
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Creando…' : 'Crear colegio'}
      </Button>
    </form>
  );
}
