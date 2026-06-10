'use client';

import { ArrowRight, KeyRound, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { authClient } from '@/lib/auth-client';

interface SchoolBrand {
  id: string;
  name: string;
  internalCode: string;
  logoUrl: string | null;
  brandHue: number | null;
  active: boolean;
}

const STORAGE_KEY = 'eez4us.lastSchoolCode';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function LoginPage() {
  const [step, setStep] = useState<'code' | 'creds'>('code');
  const [code, setCode] = useState('');
  const [school, setSchool] = useState<SchoolBrand | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const remembered = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (remembered) {
      setCode(remembered);
      lookup(remembered).catch(() => undefined);
    }
  }, []);

  // Evita el bfcache: si el browser restaura esta página desde caché (back/forward),
  // forzamos un reload para que el middleware re-evalúe la sesión.
  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) window.location.reload();
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  async function lookup(rawCode: string): Promise<void> {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(
        `/api/public/school-lookup?code=${encodeURIComponent(rawCode.trim().toUpperCase())}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === 'NOT_FOUND'
            ? 'No encontramos ningún colegio con ese código.'
            : 'Código inválido.',
        );
        return;
      }
      setSchool(data.school as SchoolBrand);
      setStep('creds');
      localStorage.setItem(STORAGE_KEY, data.school.internalCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setPending(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    await lookup(code);
  }

  async function onSubmitCreds(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? 'No se pudo iniciar sesión');
        return;
      }
      // Hard navigation: evita el flicker de back/forward cache y la cadena
      // /login → / → /admin. El server-side router resuelve todo en una sola pasada.
      window.location.replace('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setPending(false);
    }
  }

  function switchSchool() {
    localStorage.removeItem(STORAGE_KEY);
    setSchool(null);
    setCode('');
    setStep('code');
    setError(null);
  }

  const brandStyle = useMemo<React.CSSProperties>(() => {
    if (!school?.brandHue) return {};
    return {
      ['--primary' as never]: `${school.brandHue} 55% 36%`,
      ['--ring' as never]: `${school.brandHue} 55% 36%`,
    };
  }, [school?.brandHue]);

  return (
    <main style={brandStyle} className="auth-bg flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {step === 'code' ? (
            <div className="space-y-8 rounded-2xl bg-card p-10 shadow-pop border border-border">
              <div className="text-center space-y-3">
                <Image
                  src="/logo.png"
                  alt="Eez4us"
                  width={180}
                  height={90}
                  priority
                  className="mx-auto h-auto w-[180px]"
                />
                <h1 className="text-xl font-bold text-foreground">
                  Ingresa el código de tu colegio
                </h1>
              </div>

              <form onSubmit={onSubmitCode} className="space-y-5">
                <div className="flex items-center rounded-lg border border-input bg-white px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
                  <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    placeholder="ABC123"
                    value={code.toUpperCase()}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
                    }
                    autoFocus
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="ml-2 w-full bg-transparent py-3 text-sm font-bold tracking-widest outline-none placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:tracking-normal"
                  />
                </div>

                {error && (
                  <p className="text-sm font-medium text-destructive">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={pending || !code.trim()}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
                >
                  {pending ? 'Buscando…' : 'Continuar'}
                  {!pending && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </button>

                <p className="text-center text-sm">
                  <button
                    type="button"
                    onClick={() => setHelpOpen(true)}
                    className="font-semibold text-primary hover:underline"
                  >
                    ¿Dónde consigo mi código?
                  </button>
                </p>
              </form>
            </div>
          ) : (
            <div className="space-y-8 rounded-2xl bg-card p-10 shadow-pop border border-border">
              <div className="text-center space-y-3">
                {school?.logoUrl ? (
                  <img
                    src={school.logoUrl}
                    alt={school.name}
                    className="mx-auto h-20 w-auto max-w-[200px] object-contain"
                  />
                ) : (
                  <div
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-black text-primary-foreground"
                    style={{ background: 'hsl(var(--primary))' }}
                  >
                    {initials(school?.name ?? 'EE')}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-foreground">{school?.name}</h1>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mt-1">
                    Código: <span className="font-mono font-bold text-foreground">{school?.internalCode}</span>
                  </p>
                </div>
              </div>

              <form onSubmit={onSubmitCreds} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="director@colegio.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    className="mt-1 w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground">Contraseña</label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      ¿La olvidaste?
                    </Link>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-white px-3 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {error && (
                  <p className="text-sm font-medium text-destructive">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
                >
                  {pending ? 'Entrando…' : 'Entrar'}
                </button>

                <button
                  type="button"
                  onClick={switchSchool}
                  className="block w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Cambiar de colegio
                </button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* Modal "¿Dónde consigo mi código?" */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-elev"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-secondary"
            >
              <X className="h-5 w-5" />
            </button>

            <Image
              src="/logo.png"
              alt="Eez4us"
              width={130}
              height={65}
              className="mx-auto h-auto w-[130px]"
            />

            <h2 className="mt-4 text-center text-lg font-bold">¿Dónde consigo mi código?</h2>

            <div className="mt-5 flex justify-center">
              <div className="flex items-center gap-2 rounded-lg border-2 border-primary bg-white px-4 py-2">
                <KeyRound className="h-4 w-4 shrink-0 text-primary" />
                <span className="font-mono text-base font-bold tracking-widest text-foreground">
                  ABC123
                </span>
              </div>
            </div>

            <p className="mt-2 text-center text-xs font-semibold text-primary">
              ↑ Así se ve tu código
            </p>

            <p className="mt-4 text-center text-sm text-muted-foreground leading-relaxed">
              Es el código que se le entregó a tu colegio como{' '}
              <span className="font-semibold text-foreground">identificador único</span>{' '}
              dentro de Eez4us.
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground leading-relaxed">
              Si no lo encuentras, pídeselo a la{' '}
              <span className="font-semibold text-foreground">administración de tu institución</span>{' '}
              o contacta al{' '}
              <span className="font-semibold text-foreground">soporte de Eez4us</span> para una
              reposición.
            </p>

            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              className="mt-6 w-full rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
