// Fuente única de los defaults por país del piloto multi-país. School.country puede venir
// como ISO ('SV') o texto legible ('El Salvador'); normalizeCountry lo resuelve a ISO-2.
// Cada país define su moneda de cobro, zona horaria IANA, prefijo telefónico, tipo de
// documento y locale del panel. Sumar un país = una entrada acá (sin tocar el resto).

import type { DocumentType } from './documents';

export interface CountryDefaults {
  iso: string;
  currency: string; // ISO 4217
  timezone: string; // IANA
  dialCode: string; // sin '+'
  documentType: DocumentType;
  locale: string; // panel admin: es-MX | es-AR
}

// Mercado declarado: EE.UU. + México; el demo del piloto corre en El Salvador. Argentina
// queda mapeada por los ejemplos del jefe (DNI/voseo). El Salvador y EE.UU. usan USD; México
// MXN; Argentina ARS. EE.UU. tiene varias zonas: default a New York, el director la ajusta.
export const COUNTRY_DEFAULTS: Record<string, CountryDefaults> = {
  US: {
    iso: 'US',
    currency: 'USD',
    timezone: 'America/New_York',
    dialCode: '1',
    documentType: 'OTHER', // licencia de conducir / state ID; no hay documento nacional único
    locale: 'en-US',
  },
  MX: {
    iso: 'MX',
    currency: 'MXN',
    timezone: 'America/Mexico_City',
    dialCode: '52',
    documentType: 'CURP',
    locale: 'es-MX',
  },
  SV: {
    iso: 'SV',
    currency: 'USD',
    timezone: 'America/El_Salvador',
    dialCode: '503',
    documentType: 'DUI',
    locale: 'es-MX',
  },
  AR: {
    iso: 'AR',
    currency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires',
    dialCode: '54',
    documentType: 'DNI',
    locale: 'es-AR',
  },
};

const ALIASES: Record<string, string> = {
  us: 'US',
  usa: 'US',
  'united states': 'US',
  'estados unidos': 'US',
  eua: 'US',
  'ee.uu.': 'US',
  eeuu: 'US',
  mx: 'MX',
  mex: 'MX',
  mexico: 'MX',
  sv: 'SV',
  slv: 'SV',
  'el salvador': 'SV',
  salvador: 'SV',
  ar: 'AR',
  arg: 'AR',
  argentina: 'AR',
};

export function normalizeCountry(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return ALIASES[s] ?? null;
}

export function countryDefaults(raw?: string | null): CountryDefaults | null {
  const iso = normalizeCountry(raw);
  return iso ? COUNTRY_DEFAULTS[iso] : null;
}
