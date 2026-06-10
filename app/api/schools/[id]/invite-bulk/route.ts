import { prisma } from '@/lib/db';
import { parseParentsExcel } from '@/lib/excel';
import { createInvitation, pickChannel, sendInvitation } from '@/lib/invitations';
import { jsonError, requireSchool } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

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

      const studentIds = matched.map((s) => s.id);
      const parentName = `${p.firstName} ${p.lastName}`.trim();
      const studentNames = matched.map((s) => `${s.firstName} ${s.lastName}`.trim());

      const channel = pickChannel(p);
      if (!channel) {
        rowErrors.push({ parent: parentName, reason: 'sin email ni teléfono' });
        continue;
      }

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
      created.map((c) =>
        sendInvitation({
          invitationId: c.invitationId,
          channel: c.channel,
          contactValue: c.contactValue,
          token: c.token,
          parentName: c.parentName,
          studentNames: c.studentNames,
        }),
      ),
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
