import { headers } from 'next/headers';

import { auth } from './auth';

export interface AuthedSession {
  user: {
    id: string;
    email: string;
    name: string | null;
    schoolId: string | null;
    role: string;
    phoneE164: string | null;
  };
}

const STAFF_ROLES = new Set(['director', 'support_staff', 'super_admin']);

function normalize(raw: unknown): AuthedSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const user = (raw as { user?: Record<string, unknown> }).user;
  if (!user || typeof user.id !== 'string') return null;
  return {
    user: {
      id: user.id as string,
      email: (user.email as string) ?? '',
      name: (user.name as string | null) ?? null,
      schoolId: (user.schoolId as string | null) ?? null,
      role: (user.role as string) ?? 'parent',
      phoneE164: (user.phoneE164 as string | null) ?? null,
    },
  };
}

export async function getCurrentSession(): Promise<AuthedSession | null> {
  const raw = await auth.api.getSession({ headers: await headers() });
  return normalize(raw);
}

export async function getSessionFromRequest(req: Request): Promise<AuthedSession | null> {
  const raw = await auth.api.getSession({ headers: req.headers });
  return normalize(raw);
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSession(req?: Request): Promise<AuthedSession> {
  const session = req ? await getSessionFromRequest(req) : await getCurrentSession();
  if (!session) throw new HttpError(401, 'Unauthorized');
  return session;
}

export async function requireRole(
  req: Request | undefined,
  allowed: string[],
): Promise<AuthedSession> {
  const session = await requireSession(req);
  if (!allowed.includes(session.user.role)) {
    throw new HttpError(403, 'Forbidden');
  }
  return session;
}

export async function requireSchool(
  req: Request | undefined,
  schoolId: string,
  allowedRoles: string[],
): Promise<AuthedSession> {
  const session = await requireRole(req, allowedRoles);
  if (session.user.schoolId !== schoolId) {
    throw new HttpError(403, 'Forbidden: school mismatch');
  }
  return session;
}

export function isStaff(role: string): boolean {
  return STAFF_ROLES.has(role);
}

export function jsonError(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : 'Internal Error';
  return Response.json({ error: message }, { status: 500 });
}
