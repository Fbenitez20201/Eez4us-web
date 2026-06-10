import { z } from 'zod';

import { prisma } from '@/lib/db';
import { jsonError, requireRole } from '@/lib/session';

const ALLOWED_ROLES = ['super_admin'];

const createSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    commissionPct: z.number().min(0).max(1).default(0.1),
    // null = sin límite; N = la comisión corre solo los N primeros periodos de pago
    commissionMonths: z.number().int().min(1).max(60).nullable().optional(),
  })
  .refine((d) => !!d.userId || (!!d.email && !!d.name), {
    message: 'userId OR (email AND name) required',
  });

export async function GET(req: Request): Promise<Response> {
  try {
    await requireRole(req, ALLOWED_ROLES);
    const vendors = await prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { enrolledSchools: true } },
      },
    });
    return Response.json({ vendors });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    await requireRole(req, ALLOWED_ROLES);
    const body = createSchema.parse(await req.json());

    let userId = body.userId;
    if (!userId) {
      const existing = await prisma.user.findUnique({
        where: { email: body.email! },
        select: { id: true, role: true },
      });
      if (existing) {
        userId = existing.id;
        if (existing.role !== 'vendor') {
          await prisma.user.update({ where: { id: userId }, data: { role: 'vendor' } });
        }
      } else {
        const created = await prisma.user.create({
          data: {
            email: body.email!,
            name: body.name!,
            role: 'vendor',
            emailVerified: false,
          },
          select: { id: true },
        });
        userId = created.id;
      }
    } else {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!u) return Response.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
      if (u.role !== 'vendor') {
        await prisma.user.update({ where: { id: userId }, data: { role: 'vendor' } });
      }
    }

    const existingVendor = await prisma.vendor.findUnique({ where: { userId } });
    if (existingVendor) {
      return Response.json({ error: 'VENDOR_EXISTS', vendorId: existingVendor.id }, { status: 409 });
    }

    const vendor = await prisma.vendor.create({
      data: {
        userId,
        commissionPct: body.commissionPct,
        commissionMonths: body.commissionMonths ?? null,
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return Response.json({ vendor });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'INVALID_BODY', issues: err.issues }, { status: 400 });
    }
    return jsonError(err);
  }
}
