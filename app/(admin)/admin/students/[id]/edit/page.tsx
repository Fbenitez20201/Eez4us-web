import { notFound, redirect } from 'next/navigation';

import { StudentForm } from '@/components/admin/student-form';
import { prisma } from '@/lib/db';
import { getCurrentSession } from '@/lib/session';

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session || !session.user.schoolId) redirect('/login');
  const schoolId = session.user.schoolId;
  const { id } = await params;

  const [student, grades, invitations] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        schoolId: true,
        firstName: true,
        lastName: true,
        gradeId: true,
        externalId: true,
        birthDate: true,
        pickupMode: true,
        transportName: true,
        transportPlate: true,
        transportPhone: true,
        transportVehicleType: true,
        parents: {
          select: {
            parent: { select: { id: true, name: true, email: true, phoneE164: true } },
          },
        },
      },
    }),
    prisma.grade.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.invitation.findMany({
      where: { schoolId, studentIds: { has: id } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        recipientName: true,
        channel: true,
        contactValue: true,
        status: true,
        sentAt: true,
      },
    }),
  ]);

  if (!student || student.schoolId !== schoolId) notFound();

  const existingReps = student.parents.map((ps) => ps.parent);
  const pendingInvitations = invitations
    .filter((inv) => inv.status !== 'CLAIMED' && inv.status !== 'REVOKED')
    .map((inv) => ({
      id: inv.id,
      recipientName: inv.recipientName,
      channel: inv.channel,
      contactValue: inv.contactValue,
      status: inv.status,
      sentAt: inv.sentAt?.toISOString() ?? null,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Editar alumno</h1>
        <p className="text-sm text-muted-foreground">
          {student.firstName} {student.lastName}
        </p>
      </div>
      <StudentForm
        schoolId={schoolId}
        studentId={student.id}
        grades={grades}
        initial={{
          firstName: student.firstName,
          lastName: student.lastName,
          gradeId: student.gradeId,
          externalId: student.externalId,
          birthDate: student.birthDate?.toISOString() ?? null,
          pickupMode: student.pickupMode,
          transportName: student.transportName,
          transportPlate: student.transportPlate,
          transportPhone: student.transportPhone,
          transportVehicleType: student.transportVehicleType,
        }}
        existingReps={existingReps}
        pendingInvitations={pendingInvitations}
      />
    </div>
  );
}
