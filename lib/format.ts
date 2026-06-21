// Formato de fecha/hora/moneda sensible al colegio (locale + timezone). Reemplaza el
// 'es-AR' y el UTC hardcodeados. Solo Intl: corre igual en Workers (server) y en el browser
// (componentes admin). Workers trae ICU completo; igual envolvemos en try/catch por las dudas.

const DEFAULT_LOCALE = 'es-MX';
const DEFAULT_TZ = 'America/Mexico_City';

// 'YYYY-MM-DD' del instante `d` en la zona horaria `timeZone` (no en UTC). Los países del
// piloto (SV/MX/AR) no tienen DST, así que el día local es estable. Fallback a UTC si la
// runtime no soporta la tz.
export function dayKeyInTz(d: Date, timeZone?: string | null): string {
  const tz = timeZone || DEFAULT_TZ;
  try {
    // en-CA da el orden YYYY-MM-DD directo.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

// Genera las últimas `count` fechas locales (incluido hoy) como claves 'YYYY-MM-DD' en `timeZone`.
// Resuelve la fecha local de HOY una vez y resta días por aritmética de calendario (Date.UTC),
// no por deltas fijos de 24h: así es estable aun en zonas con DST (sin días duplicados/saltados)
// y las claves coinciden con dayKeyInTz() usado para bucketear los eventos.
export function lastLocalDays(count: number, timeZone?: string | null, now: Date = new Date()): string[] {
  const [y, m, d] = dayKeyInTz(now, timeZone).split('-').map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
      dt.getUTCDate(),
    ).padStart(2, '0')}`;
    out.push(key);
  }
  return out;
}

export function formatDate(
  d: Date | string | null | undefined,
  opts?: { locale?: string | null; timeZone?: string | null; withTime?: boolean },
): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  const locale = opts?.locale || DEFAULT_LOCALE;
  const fmt: Intl.DateTimeFormatOptions = {
    timeZone: opts?.timeZone || DEFAULT_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(opts?.withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  };
  try {
    return new Intl.DateTimeFormat(locale, fmt).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function formatTime(
  d: Date | string | null | undefined,
  opts?: { locale?: string | null; timeZone?: string | null },
): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(opts?.locale || DEFAULT_LOCALE, {
      timeZone: opts?.timeZone || DEFAULT_TZ,
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}

export function formatMoney(amount: number, currency = 'USD', locale = DEFAULT_LOCALE): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
