// Tipos de documento de identidad por país, fuente única para schema/API/UI.
// Texto libre en DB (no enum Postgres) para sumar países sin migración; la validación de
// valor permitido vive acá. DUI=El Salvador, DNI=Argentina, RFC/CURP=México.

import { countryDefaults } from './country';

export const DOCUMENT_TYPES = ['DUI', 'DNI', 'RFC', 'CURP', 'PASSPORT', 'OTHER'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const LABELS: Record<DocumentType, string> = {
  DUI: 'DUI',
  DNI: 'DNI',
  RFC: 'RFC',
  CURP: 'CURP',
  PASSPORT: 'Pasaporte',
  OTHER: 'Otro',
};

// Tipo por defecto sugerido para un país (para defaults de UI). null si no mapeado.
// Reusa countryDefaults para no duplicar el mapeo país→documento.
export function defaultDocumentTypeForCountry(country?: string | null): DocumentType | null {
  return countryDefaults(country)?.documentType ?? null;
}

export function documentTypeLabel(type?: string | null): string | null {
  if (!type) return null;
  return LABELS[type as DocumentType] ?? type;
}
