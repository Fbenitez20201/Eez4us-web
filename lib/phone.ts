// Validación de teléfono por país. Antes era E.164 genérico en todos lados; el piloto
// multi-país necesita rechazar prefijos/longitudes que no son del país de la escuela
// (ej. un número MX cargado en una escuela de El Salvador). Workers-safe: solo regex + strings.
//
// School.country puede venir como ISO ('SV') o texto libre ('El Salvador'); normalizeCountry
// (lib/country.ts) lo resuelve. País desconocido => cae a E.164 genérico (no bloquea países
// aún no mapeados).

import { normalizeCountry } from './country';

const GENERIC_E164 = /^\+[1-9]\d{6,14}$/;

// Por país: prefijo de marcación y rango de dígitos del número nacional (sin el prefijo).
//  US +1: 10 dígitos (NANP). SV +503: 8. MX +52: 10 (u 11 con el "1" legado). AR +54: 10 u 11 (el "9" móvil).
const SPECS: Record<string, { dial: string; min: number; max: number }> = {
  US: { dial: '1', min: 10, max: 10 },
  MX: { dial: '52', min: 10, max: 11 },
  SV: { dial: '503', min: 8, max: 8 },
  AR: { dial: '54', min: 10, max: 11 },
};

export type PhoneErrorCode =
  | 'PHONE_NOT_E164'
  | 'PHONE_WRONG_COUNTRY_CODE'
  | 'PHONE_WRONG_LENGTH';

export interface PhoneCheck {
  valid: boolean;
  error?: PhoneErrorCode;
}

// Prefijo +E.164 sugerido para un país (para defaults de UI). null si no mapeado.
export function dialPrefixForCountry(raw?: string | null): string | null {
  const iso = normalizeCountry(raw);
  return iso ? `+${SPECS[iso].dial}` : null;
}

export function validatePhoneForCountry(phone: string, country?: string | null): PhoneCheck {
  const e164 = phone.trim();
  if (!GENERIC_E164.test(e164)) return { valid: false, error: 'PHONE_NOT_E164' };

  const iso = normalizeCountry(country);
  const spec = iso ? SPECS[iso] : null;
  if (!spec) return { valid: true }; // país desconocido: E.164 genérico ya validó

  if (!e164.startsWith(`+${spec.dial}`)) return { valid: false, error: 'PHONE_WRONG_COUNTRY_CODE' };
  const national = e164.slice(1 + spec.dial.length);
  if (national.length < spec.min || national.length > spec.max) {
    return { valid: false, error: 'PHONE_WRONG_LENGTH' };
  }
  return { valid: true };
}

// Azúcar para flujos que solo necesitan booleano (Excel, validaciones masivas).
export function isValidPhoneForCountry(phone: string, country?: string | null): boolean {
  return validatePhoneForCountry(phone, country).valid;
}
