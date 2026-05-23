import { read, utils } from 'xlsx';
import { z } from 'zod';

const parentRowSchema = z.object({
  firstName: z.string().trim().min(1, 'firstName requerido'),
  lastName: z.string().trim().min(1, 'lastName requerido'),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'phoneE164 debe ser E.164 (e.g. +5215512345678)')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  studentExternalIds: z.array(z.string().trim().min(1)).min(1, 'al menos un estudiante'),
});

export type ParentRow = z.infer<typeof parentRowSchema>;

export interface ParseParentsExcelResult {
  parents: ParentRow[];
  errors: { row: number; message: string }[];
}

const HEADER_MAP: Record<string, keyof ParentRow | 'studentExternalIdsRaw'> = {
  firstname: 'firstName',
  nombre: 'firstName',
  nombres: 'firstName',
  lastname: 'lastName',
  apellido: 'lastName',
  apellidos: 'lastName',
  email: 'email',
  correo: 'email',
  'correo electronico': 'email',
  phone: 'phoneE164',
  phonee164: 'phoneE164',
  telefono: 'phoneE164',
  whatsapp: 'phoneE164',
  studentexternalids: 'studentExternalIdsRaw',
  alumnos: 'studentExternalIdsRaw',
  matriculas: 'studentExternalIdsRaw',
  matricula: 'studentExternalIdsRaw',
};

function normalizeHeader(h: string): string {
  return h
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function splitIds(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  return String(raw)
    .split(/[,;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseParentsExcel(buffer: ArrayBuffer | Uint8Array): ParseParentsExcelResult {
  const wb = read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { parents: [], errors: [{ row: 0, message: 'Excel sin hojas' }] };
  }
  const sheet = wb.Sheets[sheetName];
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const parents: ParentRow[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((row, idx) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const mapped = HEADER_MAP[normalizeHeader(key)];
      if (mapped) normalized[mapped] = value;
    }

    const candidate = {
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      email: normalized.email,
      phoneE164: normalized.phoneE164,
      studentExternalIds: splitIds(normalized.studentExternalIdsRaw),
    };

    const parsed = parentRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        row: idx + 2,
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
      return;
    }
    if (!parsed.data.email && !parsed.data.phoneE164) {
      errors.push({ row: idx + 2, message: 'falta email o phoneE164' });
      return;
    }
    parents.push(parsed.data);
  });

  return { parents, errors };
}
