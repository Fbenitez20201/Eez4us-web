// Token firmado de la tarjeta QR del alumno. ESTABLE (no de corta vida): identifica
// al alumno y a su escuela. Stateless (HMAC-SHA256, Workers-safe: solo crypto.subtle).
//
// La AUTORIDAD la pone el `verify` (que el alumno tenga una recogida activa y autorizada
// AHORA), NO el token — una tarjeta robada/fotocopiada no entrega nada si no hay viaje
// activo. El token es solo identidad: por eso es persistente (la tarjeta impresa sigue
// sirviendo) y a la vez inofensivo si se filtra.
//
// No usamos un secret nuevo: derivamos la llave del BETTER_AUTH_SECRET con una etiqueta
// de dominio, así no tocamos provisioning de Cloudflare.

const TOKEN_VERSION = 's1'; // s = student card (estable). Sucede a 'r1' (token por-viaje, retirado).

export type RosterTokenErrorCode = 'INVALID_TOKEN';

export class RosterTokenError extends Error {
  code: RosterTokenErrorCode;
  constructor(code: RosterTokenErrorCode) {
    super(code);
    this.code = code;
  }
}

export interface StudentQrClaims {
  studentId: string;
  schoolId: string;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
}

async function signingKey(): Promise<CryptoKey> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET not set');
  // separación de dominio: esta llave solo firma QRs de roster, nunca sesiones.
  const material = new TextEncoder().encode(`${secret}\x00eez4us-roster-qr`);
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

// Tarjeta fija: sin vencimiento (expiresAt = null). Si en el futuro hay que rotar por
// robo, se añade un sufijo de versión al payload (p.ej. un `qrVersion` por alumno) sin
// cambiar el contrato del cliente — el shape devuelto ya admite expiresAt nullable.
export async function mintStudentQrToken(claims: {
  studentId: string;
  schoolId: string;
}): Promise<{ token: string; expiresAt: string | null }> {
  // cuids no contienen puntos → el join por '.' es inambiguo
  const payload = `${TOKEN_VERSION}.${claims.studentId}.${claims.schoolId}`;
  const payloadBytes = new TextEncoder().encode(payload);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(), payloadBytes));
  const token = `${bytesToB64url(payloadBytes)}.${bytesToB64url(sig)}`;
  return { token, expiresAt: null };
}

export async function verifyStudentQrToken(token: string): Promise<StudentQrClaims> {
  const dot = token.indexOf('.');
  if (dot <= 0) throw new RosterTokenError('INVALID_TOKEN');
  const pB64 = token.slice(0, dot);
  const sB64 = token.slice(dot + 1);
  if (!pB64 || !sB64) throw new RosterTokenError('INVALID_TOKEN');

  let payloadBytes: Uint8Array;
  let sig: Uint8Array;
  try {
    payloadBytes = b64urlToBytes(pB64);
    sig = b64urlToBytes(sB64);
  } catch {
    throw new RosterTokenError('INVALID_TOKEN');
  }

  const ok = await crypto.subtle.verify(
    'HMAC',
    await signingKey(),
    sig as BufferSource,
    payloadBytes as BufferSource,
  );
  if (!ok) throw new RosterTokenError('INVALID_TOKEN');

  const parts = new TextDecoder().decode(payloadBytes).split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) throw new RosterTokenError('INVALID_TOKEN');

  return { studentId: parts[1], schoolId: parts[2] };
}
