import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const ALLOWED_ROLES = ['super_admin'];

const bodySchema = z.object({ schoolId: z.string().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole(req, ALLOWED_ROLES);
    const { id: vendorId } = await params;
    const { schoolId } = bodySchema.parse(await req.json());

    const [vendor, school] = await Promise.all([
      prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true } }),
      prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } }),
    ]);
    if (!vendor) return Response.json({ error: 'VENDOR_NOT_FOUND' }, { status: 404 });
    if (!school) return Response.json({ error: 'SCHOOL_NOT_FOUND' }, { status: 404 });

    const link = await prisma.vendorSchool.upsert({
      where: { vendorId_schoolId: { vendorId, schoolId } },
      create: { vendorId, schoolId },
      update: {},
    });
    return Response.json({ link });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireRole(req, ALLOWED_ROLES);
    const { id: vendorId } = await params;
    const url = new URL(req.url);
    const schoolId = url.searchParams.get('schoolId');
    if (!schoolId) {
      return Response.json({ error: 'MISSING_SCHOOL_ID' }, { status: 400 });
    }

    await prisma.vendorSchool.deleteMany({ where: { vendorId, schoolId } });
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
