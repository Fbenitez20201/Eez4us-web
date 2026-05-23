import { prisma } from '@/lib/db';
import { parseParentsExcel } from '@/lib/excel';
import { createInvitation } from '@/lib/invitations';
import { sendInvitationEmail } from '@/lib/mailer';
import { sendWhatsAppInvitation } from '@/lib/n8n';
import { jsonError, requireSchool } from '@/lib/session';

export const runtime = 'edge';

const ALLOWED_ROLES = ['director', 'super_admin'];

function inviteLink(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? '';
  return `${base.replace(/\/$/, '')}/invite/${token}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: schoolId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'FILE_REQUIRED' }, { status: 400 });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const { parents, errors } = parseParentsExcel(buf);
    if (!parents.length) {
      return Response.json({ error: 'NO_VALID_ROWS', errors }, { status: 400 });
    }

    const allExternalIds = [...new Set(parents.flatMap((p) => p.studentExternalIds))];
    const students = await prisma.student.findMany({
      where: { schoolId, externalId: { in: allExternalIds } },
      select: { id: true, externalId: true, firstName: true, lastName: true },
    });
    const studentByExt = new Map(students.map((s) => [s.externalId ?? '', s]));

    const created: Array<{
      invitationId: string;
      token: string;
      channel: 'EMAIL' | 'WHATSAPP';
      contactValue: string;
      parentName: string;
      studentNames: string[];
    }> = [];
    const rowErrors: Array<{ parent: string; reason: string }> = [...errors.map((e) => ({
      parent: `row ${e.row}`,
      reason: e.message,
    }))];

    for (const p of parents) {
      const matched = p.studentExternalIds
        .map((ext) => studentByExt.get(ext))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));

      if (matched.length === 0) {
        rowErrors.push({
          parent: `${p.firstName} ${p.lastName}`,
          reason: 'sin estudiantes matched',
        });
        continue;
      }

      const channel: 'EMAIL' | 'WHATSAPP' = p.email ? 'EMAIL' : 'WHATSAPP';
      const studentIds = matched.map((s) => s.id);
      const parentName = `${p.firstName} ${p.lastName}`.trim();
      const studentNames = matched.map((s) => `${s.firstName} ${s.lastName}`.trim());

      try {
        const invitation = await createInvitation({
          schoolId,
          parent: p,
          studentIds,
          channel,
        });
        created.push({
          invitationId: invitation.id,
          token: invitation.token,
          channel,
          contactValue: invitation.contactValue,
          parentName,
          studentNames,
        });
      } catch (err) {
        rowErrors.push({
          parent: parentName,
          reason: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    const sendResults = await Promise.allSettled(
      created.map(async (c) => {
        const link = inviteLink(c.token);
        if (c.channel === 'EMAIL') {
          await sendInvitationEmail({
            email: c.contactValue,
            link,
            parentName: c.parentName,
            studentNames: c.studentNames,
          });
        } else {
          await sendWhatsAppInvitation({
            phone: c.contactValue,
            link,
            parentName: c.parentName,
            studentNames: c.studentNames,
          });
        }
        await prisma.invitation.update({
          where: { id: c.invitationId },
          data: { status: 'SENT', sentAt: new Date() },
        });
        return c.invitationId;
      }),
    );

    const sendFailures = sendResults
      .map((r, i) => (r.status === 'rejected' ? { parent: created[i].parentName, reason: String(r.reason) } : null))
      .filter(Boolean);

    return Response.json({
      createdCount: created.length,
      sentCount: sendResults.filter((r) => r.status === 'fulfilled').length,
      rowErrors,
      sendFailures,
    });
  } catch (err) {
    return jsonError(err);
  }
}
