import { z } from 'zod';

import { auth } from '@/lib/auth';
import { claimInvitation } from '@/lib/invitations';
import { sendPushToSchoolRoles } from '@/lib/push';
import { HttpError, jsonError } from '@/lib/session';

const bodySchema = z.object({
  token: z.string().min(8).max(64),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const json = await req.json();
    const body = bodySchema.parse(json);
    const result = await claimInvitation(body);

    let jwt: string | null = null;
    try {
      const tokenResponse = await auth.api.getToken({
        headers: result.setCookie ? new Headers({ cookie: result.setCookie }) : new Headers(),
      });
      jwt = (tokenResponse as { token?: string } | null)?.token ?? null;
    } catch {
      jwt = null;
    }

    try {
      await sendPushToSchoolRoles(result.schoolId, ['director', 'super_admin'], {
        title: 'Padre claimeó invitación',
        body: `${body.name} se unió`,
        data: { type: 'invitation-claimed', userId: result.userId },
      });
    } catch {
      // no bloquear el claim si el push falla
    }

    const res = Response.json({
      userId: result.userId,
      schoolId: result.schoolId,
      sessionToken: result.sessionToken,
      jwt,
    });
    if (result.setCookie) {
      res.headers.append('set-cookie', result.setCookie);
    }
    return res;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    if (err instanceof Error) {
      const known = [
        'INVITATION_NOT_FOUND',
        'INVITATION_ALREADY_USED',
        'INVITATION_EXPIRED',
        'SIGNUP_FAILED',
        'PHONE_INVALID',
      ];
      if (known.includes(err.message)) {
        return Response.json({ error: err.message }, { status: 400 });
      }
    }
    if (err instanceof HttpError) {
      return jsonError(err);
    }
    return jsonError(err);
  }
}
