import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireSchool } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(50).max(500).optional(),
  active: z.boolean().optional(),
});

async function assertOwnership(schoolId: string, ppId: string): Promise<boolean> {
  const pp = await prisma.pickupPoint.findUnique({
    where: { id: ppId },
    select: { schoolId: true },
  });
  return pp?.schoolId === schoolId;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; ppId: string }> },
): Promise<Response> {
  try {
    const { id: schoolId, ppId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    if (!(await assertOwnership(schoolId, ppId))) {
      return Response.json({ error: 'PICKUP_POINT_NOT_FOUND' }, { status: 404 });
    }
    const body = patchSchema.parse(await req.json());
    const pickupPoint = await prisma.pickupPoint.update({
      where: { id: ppId },
      data: body,
      select: {
        id: true,
        name: true,
        centerLat: true,
        centerLng: true,
        radiusMeters: true,
        active: true,
      },
    });
    return Response.json({ pickupPoint });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; ppId: string }> },
): Promise<Response> {
  try {
    const { id: schoolId, ppId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    if (!(await assertOwnership(schoolId, ppId))) {
      return Response.json({ error: 'PICKUP_POINT_NOT_FOUND' }, { status: 404 });
    }
    await prisma.pickupPoint.update({
      where: { id: ppId },
      data: { active: false },
    });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
