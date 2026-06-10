import { customAlphabet } from 'nanoid';

import { prisma } from '@/lib/db';
import { dispatchInvitation, inviteLink } from '@/lib/invitations';
import { jsonError, requireSchool } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

const TOKEN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateToken = customAlphabet(TOKEN_ALPHABET, 24);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; invId: string }> },
): Promise<Response> {
  try {
    const { id: schoolId, invId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);

    const inv = await prisma.invitation.findUnique({
      where: { id: invId },
      include: {
        school: { select: { id: true, name: true } },
      },
    });
    if (!inv || inv.schoolId !== schoolId) {
      return Response.json({ error: 'INVITATION_NOT_FOUND' }, { status: 404 });
    }
    if (inv.status === 'CLAIMED' || inv.status === 'REVOKED') {
      return Response.json({ error: 'INVITATION_NOT_RESENDABLE' }, { status: 409 });
    }

    const students = await prisma.student.findMany({
      where: { id: { in: inv.studentIds } },
      select: { firstName: true, lastName: true },
    });
    const studentNames = students.map((s) => `${s.firstName} ${s.lastName}`.trim());

    const newToken = generateToken();
    const newExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const parentName = inv.recipientName ?? 'Padre/Madre';

    await dispatchInvitation({
      channel: inv.channel,
      contactValue: inv.contactValue,
      link: inviteLink(newToken),
      parentName,
      studentNames,
    });

    const updated = await prisma.invitation.update({
      where: { id: invId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        status: 'SENT',
        sentAt: new Date(),
      },
      select: { id: true, status: true, sentAt: true, expiresAt: true },
    });

    return Response.json({ invitation: updated });
  } catch (err) {
    return jsonError(err);
  }
}
