import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await requireRole(req, ['parent']);
    const links = await prisma.parentStudent.findMany({
      where: { parentId: session.user.id, student: { active: true } },
      orderBy: { createdAt: 'asc' },
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            grade: { select: { id: true, name: true } },
            pickupMode: true,
            transportName: true,
            transportPlate: true,
            transportPhone: true,
            transportVehicleType: true,
          },
        },
      },
    });
    return Response.json({
      students: links.map((l) => ({
        id: l.student.id,
        firstName: l.student.firstName,
        lastName: l.student.lastName,
        grade: l.student.grade,
        pickupMode: l.student.pickupMode,
        transport:
          l.student.pickupMode === 'TRANSPORT'
            ? {
                name: l.student.transportName,
                plate: l.student.transportPlate,
                phone: l.student.transportPhone,
                vehicleType: l.student.transportVehicleType,
              }
            : null,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
