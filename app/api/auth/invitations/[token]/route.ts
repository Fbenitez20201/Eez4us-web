import { prisma } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      recipientName: true,
      studentIds: true,
      school: { select: { name: true } },
    },
  });
  if (!invitation) {
    return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const expired = invitation.expiresAt.getTime() < Date.now();
  const status = expired && invitation.status !== 'CLAIMED' ? 'EXPIRED' : invitation.status;

  const students = invitation.studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: invitation.studentIds } },
        select: { firstName: true, lastName: true },
      })
    : [];

  return Response.json({
    schoolName: invitation.school.name,
    parentName: invitation.recipientName,
    studentNames: students.map((s) => `${s.firstName} ${s.lastName}`.trim()),
    status,
    expiresAt: invitation.expiresAt.toISOString(),
  });
}
