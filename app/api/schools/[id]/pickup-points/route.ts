import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireSchool } from '@/lib/session';

const ALLOWED_ROLES = ['director', 'super_admin'];

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(50).max(500),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id: schoolId } = await params;
    await requireSchool(req, schoolId, ALLOWED_ROLES);
    const body = createSchema.parse(await req.json());

    const pickupPoint = await prisma.pickupPoint.create({
      data: {
        schoolId,
        name: body.name,
        centerLat: body.centerLat,
        centerLng: body.centerLng,
        radiusMeters: body.radiusMeters,
      },
      select: {
        id: true,
        name: true,
        centerLat: true,
        centerLng: true,
        radiusMeters: true,
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
